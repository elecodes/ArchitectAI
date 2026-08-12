#!/usr/bin/env bash
set -uo pipefail
PORT=3002; KEEP=0
while [[ $# -gt 0 ]]; do case "$1" in
  --keep) KEEP=1 ;;
  --port) PORT="${2:?--port requires a value}"; shift ;;
  *) echo "unknown arg: $1" >&2; exit 2 ;;
esac; shift; done
cd "$(dirname "$0")/.." || exit 1
PROD_BASE="http://localhost:$PORT"; DEV_HEALTH="http://localhost:3001/api/health"
PASSED=0; FAILED=0
pass() { PASSED=$((PASSED + 1)); echo "PASS $1"; }
fail() { FAILED=$((FAILED + 1)); echo "FAIL $1 ($2)"; }
assert_eq() { if [[ "$2" == "$3" ]]; then pass "$1"; else fail "$1" "got: $2, want: $3"; fi; }
json_field() { python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get(sys.argv[2],''))" "$1" "$2" 2>/dev/null || echo ""; }
error_code() { python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print((d.get('error') or {}).get('code') or '')" "$1" 2>/dev/null || echo ""; }

echo "=== PREFLIGHT ==="
if ! docker info >/dev/null 2>&1; then echo "FAIL docker not reachable"; exit 1; fi
pass "docker reachable"
mkdir -p /tmp/sprint8/repo /tmp/sprint8/outside
printf 'export const a = 1\n' > /tmp/sprint8/repo/a.ts
printf 'secret\n' > /tmp/sprint8/outside/secret.txt
pass "fixtures created"

echo "=== START STACK (dev/mock) ==="
docker compose up -d --build db app

echo "=== TEST 1: stack healthy ==="
healthy=0
for _ in $(seq 1 120); do
  st=$(docker inspect -f '{{.State.Health.Status}}' architectai-app-1 2>/dev/null || echo notfound)
  if [[ "$st" == "healthy" ]]; then healthy=1; break; fi
  sleep 1
done
if [[ "$healthy" == "1" ]]; then pass "stack healthy"; else fail "stack healthy" "architectai-app-1 not healthy within 120s"; fi

echo "=== TEST 2: health ==="
code=$(curl -s -o /tmp/sprint8/body.json -w '%{http_code}' --max-time 10 "$DEV_HEALTH")
assert_eq "health http 200" "$code" "200"
assert_eq "health status ok" "$(json_field /tmp/sprint8/body.json status)" "ok"
if curl -sI --max-time 10 "$DEV_HEALTH" | grep -qi '^X-Request-ID:'; then
  pass "health x-request-id header"
else
  fail "health x-request-id header" "header missing"
fi

echo "=== BUILD PROD IMAGE ==="
if docker build -t architectai-smoke . >/dev/null 2>&1; then
  pass "built architectai-smoke"
elif docker image inspect architectai-app >/dev/null 2>&1; then
  docker tag architectai-app architectai-smoke
  pass "reused architectai-app image"
else
  fail "build prod image" "docker build failed, no architectai-app to reuse"
fi
docker rm -f architectai-smoke >/dev/null 2>&1 || true

echo "=== RUN PROD INSTANCE ==="
docker run -d --name architectai-smoke --network architectai_default \
  -e DATABASE_URL=postgresql://architect:architect@db:5432/architectai \
  -e NODE_ENV=production \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e LLM_PROVIDER=ollama \
  -e EMBEDDING_PROVIDER=ollama \
  -e ALLOWED_FS_ROOTS=/srv/repo \
  -e RATE_LIMIT_INDEX=3 \
  -e PORT="$PORT" \
  -v /tmp/sprint8/repo:/srv/repo:ro \
  -v /tmp/sprint8/outside:/srv/outside:ro \
  -p "$PORT:$PORT" \
  architectai-smoke
up=0
for _ in $(seq 1 120); do
  rc=$(curl -s -o /dev/null -w '%{http_code}' -m 3 "$PROD_BASE/api/health" 2>/dev/null)
  if [[ "$rc" != "000" ]]; then up=1; break; fi
  sleep 1
done
if [[ "$up" == "1" ]]; then pass "prod instance up"; else fail "prod instance up" "no HTTP response within 120s"; fi

echo "=== TEST 3: prod auth + project ==="
TOKEN=$(curl -s --max-time 10 -X POST "$PROD_BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"architect"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
if [[ -n "$TOKEN" ]]; then pass "login token"; else fail "login token" "no token returned"; fi
AUTH="Authorization: Bearer $TOKEN"
PID=$(curl -s --max-time 10 -X POST "$PROD_BASE/api/projects" \
  -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"name":"smoke-sprint8"}' \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
p=d.get('id')
if p is None:
    p=(d.get('data') or {}).get('id')
print(p if p is not None else '')
" 2>/dev/null)
if [[ -n "$PID" ]]; then pass "project created (id=$PID)"; else fail "project created" "no id in response"; fi

echo "=== TEST 4: containment (escape) ==="
code=$(curl -s -o /tmp/sprint8/esc.json -w '%{http_code}' --max-time 10 \
  -X POST "$PROD_BASE/api/projects/$PID/index" \
  -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"path":"/srv/outside/secret.txt"}')
assert_eq "escape http 400" "$code" "400"
assert_eq "escape error code" "$(error_code /tmp/sprint8/esc.json)" "PATH_NOT_ALLOWED"

echo "=== TEST 5: containment (in-root allowed) ==="
code=$(curl -s -o /tmp/sprint8/in.json -w '%{http_code}' --max-time 10 \
  -X POST "$PROD_BASE/api/projects/$PID/index" \
  -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"path":"/srv/repo/a.ts"}')
if [[ "$code" != "400" ]] && ! grep -q 'PATH_NOT_ALLOWED' /tmp/sprint8/in.json; then
  pass "in-root allowed (http=$code)"
else
  fail "in-root allowed" "containment triggered for in-root path (http=$code)"
fi

echo "=== TEST 6: rate limit ==="
n429=0; code_ok=0
for _ in 1 2 3 4; do
  rc=$(curl -s -o /tmp/sprint8/rate.json -w '%{http_code}' --max-time 10 \
    -X POST "$PROD_BASE/api/projects/$PID/index" \
    -H 'Content-Type: application/json' -H "$AUTH" \
    -d '{"path":"/srv/repo/a.ts"}')
  if [[ "$rc" == "429" ]]; then
    n429=$((n429 + 1))
    if [[ "$(error_code /tmp/sprint8/rate.json)" == "RATE_LIMITED" ]]; then code_ok=1; fi
  fi
done
if [[ "$n429" -ge 1 ]]; then pass "rate limit 429 ($n429/4)"; else fail "rate limit 429" "no 429 responses"; fi
if [[ "$code_ok" == "1" ]]; then pass "rate limit error code"; else fail "rate limit error code" "RATE_LIMITED missing on 429 responses"; fi

echo "=== TEST 7: graceful shutdown ==="
docker stop -t 30 architectai-smoke >/dev/null 2>&1
assert_eq "exit code 0" "$(docker inspect -f '{{.State.ExitCode}}' architectai-smoke 2>/dev/null)" "0"
if docker logs architectai-smoke 2>&1 | grep -q 'Shutdown complete'; then
  pass "shutdown complete log"
else
  fail "shutdown complete log" "log line missing"
fi

if [[ "$KEEP" == "0" ]]; then
  echo "=== CLEANUP ==="
  docker rm -f architectai-smoke >/dev/null 2>&1 || true
  docker compose down >/dev/null 2>&1 || true
  docker rmi architectai-smoke >/dev/null 2>&1 || true
  rm -rf /tmp/sprint8
  echo "cleanup done"
else
  echo "=== CLEANUP SKIPPED (--keep) ==="
fi

echo "=== SUMMARY ==="
echo "PASS: $PASSED"
echo "FAIL: $FAILED"
[[ "$FAILED" -eq 0 ]]
