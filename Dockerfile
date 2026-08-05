# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:20-slim AS runner
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY src/prompts/ ./dist/prompts/
COPY src/db/migrations/ ./dist/db/migrations/
USER app
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "dist/index.js"]
