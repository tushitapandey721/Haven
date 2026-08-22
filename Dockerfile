# ==============================================================================
# Multi-stage Dockerfile for SENTINEL AI Safety Platform
# ==============================================================================

# --- Stage 1: Build & Package ---
FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

# Copy manifest files first for cache efficiency
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

# Install all workspace dependencies
RUN pnpm install

# Build static frontend and bundled API server
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/sentinel-ai run build
RUN node artifacts/api-server/build.mjs

# --- Stage 2: Production Runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install curl for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

# Copy repository & built assets
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

# Install production dependencies
RUN pnpm install

# Copy built frontend into dist
COPY --from=builder /app/artifacts/sentinel-ai/dist /app/artifacts/sentinel-ai/dist
COPY --from=builder /app/artifacts/api-server/dist /app/artifacts/api-server/dist

ENV NODE_ENV=production
ENV PORT=5000

# Set non-root permissions
USER node

EXPOSE 5000 3000

# Health check against API server
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/healthz || exit 1

# Start the Sentinel API server
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]