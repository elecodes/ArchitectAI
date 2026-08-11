# Build backend
FROM node:20-slim AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production
FROM node:20-slim AS runner
WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

# Backend
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-builder /app/dist ./dist
COPY src/prompts/*.md ./dist/prompts/
COPY src/db/migrations/ ./dist/db/migrations/

# Frontend (serve as static files)
COPY --from=frontend-builder /app/dist ./dist/public

RUN mkdir -p /app/data && chown -R app:app /app/data

USER app
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=3 CMD node -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
