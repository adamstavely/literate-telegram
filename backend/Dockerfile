# ============================================================
# Stage 1 — builder
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /build

# Install dependencies first (layer-cache friendly)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies so only production deps are copied
RUN npm ci --omit=dev --ignore-scripts

# ============================================================
# Stage 2 — runner
# ============================================================
FROM node:20-alpine AS runner

# Non-root user already exists in node:alpine as uid 1000
WORKDIR /app

# Copy production node_modules and compiled output from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist        ./dist

# Create a writable tmp dir for potential runtime writes (logs, etc.)
RUN mkdir -p /app/tmp && chown -R node:node /app

USER node

EXPOSE 3000

# Use node (always present) rather than wget/curl, which node:20-alpine may not ship.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
