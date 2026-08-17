# ==========================================
# Stage 1: Base Image
# ==========================================
FROM node:20-alpine AS base
WORKDIR /app

# ==========================================
# Stage 2: Production Dependencies (deps)
# ==========================================
FROM base AS deps
COPY package*.json ./
# Install only production dependencies cleanly
RUN npm ci --omit=dev

# ==========================================
# Stage 3: Build Stage (builder)
# ==========================================
FROM base AS builder
COPY package*.json ./
# Install all dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source code and TS config
COPY tsconfig.json ./
COPY src ./src
# Compile TypeScript to JavaScript (/app/dist)
RUN npm run build

# ==========================================
# Stage 4: Production Runner
# ==========================================
FROM base AS runner

# Set node environment
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Security: Run as unprivileged node user
USER node

# Copy production node_modules from 'deps' stage
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Copy compiled JavaScript dist from 'builder' stage
COPY --chown=node:node --from=builder /app/dist ./dist

# Expose server port
EXPOSE 4000

# Native Node.js Healthcheck (Zero external package dependencies)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start production server
CMD ["node", "dist/index.js"]
