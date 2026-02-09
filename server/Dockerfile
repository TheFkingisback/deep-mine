FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package first
COPY packages/shared/package.json packages/shared/
COPY packages/shared/src/ packages/shared/src/
COPY packages/shared/tsconfig.json packages/shared/

# Copy server package
COPY server/package.json server/
COPY server/tsconfig.json server/

# Install dependencies
WORKDIR /app/server
RUN npm install

# Build TypeScript
RUN npx tsc

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

# Copy shared source (needed for path resolution)
COPY --from=builder /app/packages/shared/ packages/shared/

# Copy server build and dependencies
COPY --from=builder /app/server/dist/ server/dist/
COPY --from=builder /app/server/node_modules/ server/node_modules/
COPY --from=builder /app/server/package.json server/

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=9001

EXPOSE 9001

CMD ["node", "dist/main.js"]
