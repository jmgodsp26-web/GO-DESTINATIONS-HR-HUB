# --- Stage 1: Build Phase ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./

# Install all dependencies (including build tools: vite, esbuild, typescript)
RUN npm ci

# Copy source code
COPY . .

# Build both frontend SPA (dist/) and Express server (dist/server.cjs)
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package definition and install only runtime dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled outputs from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

USER node

# Expose the Cloud Run container port
EXPOSE 8080

# Start production server
CMD ["node", "dist/server.cjs"]
