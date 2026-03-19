# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ARG PNPM_VERSION=9.12.3
ARG PRISMA_CLI_VERSION=6.19.2
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PNPM_STORE_DIR=/pnpm/store
RUN npm config set fetch-retries 8 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY patches ./patches
COPY apps/workers/package.json apps/workers/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @corelia/workers... --store-dir /pnpm/store

FROM deps AS builder
ARG PRISMA_CLI_VERSION=6.19.2
COPY . .
RUN mkdir -p apps/workers/prisma \
  && cp apps/api/prisma/schema.prisma apps/workers/prisma/schema.prisma \
  && PRISMA_GENERATE_SKIP_AUTOINSTALL=1 pnpm dlx prisma@${PRISMA_CLI_VERSION} generate --schema apps/workers/prisma/schema.prisma
RUN pnpm --filter @corelia/types build
RUN pnpm --filter @corelia/workers build

FROM base AS prod-deps
ARG PRISMA_CLI_VERSION=6.19.2
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY patches ./patches
COPY apps/workers/package.json apps/workers/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @corelia/workers... --store-dir /pnpm/store
COPY --from=builder /app/apps/workers/prisma ./apps/workers/prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  PRISMA_GENERATE_SKIP_AUTOINSTALL=1 pnpm dlx prisma@${PRISMA_CLI_VERSION} generate --schema /app/apps/workers/prisma/schema.prisma

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/workers/node_modules ./apps/workers/node_modules
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder /app/apps/workers/package.json ./apps/workers/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
CMD ["node", "apps/workers/dist/main.js"]
