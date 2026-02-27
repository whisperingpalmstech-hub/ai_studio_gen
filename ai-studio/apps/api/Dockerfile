# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json packages/database/
COPY packages/database/types.ts packages/database/
COPY apps/api/package.json apps/api/

# Install pnpm and dependencies
RUN npm install -g pnpm@8.15.0
RUN pnpm install --frozen-lockfile --filter @ai-studio/api... --filter @ai-studio/database

# Copy API source code
COPY apps/api/ apps/api/
COPY tsconfig.json ./

# Build TypeScript
RUN cd apps/api && pnpm run build

# ---- Production Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Copy workspace structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json packages/database/
COPY packages/database/types.ts packages/database/
COPY apps/api/package.json apps/api/

# Install pnpm and production dependencies only
RUN npm install -g pnpm@8.15.0
RUN pnpm install --frozen-lockfile --prod --filter @ai-studio/api... --filter @ai-studio/database

# Copy built output from builder
COPY --from=builder /app/apps/api/dist apps/api/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Start the API server
CMD ["node", "apps/api/dist/index.js"]
