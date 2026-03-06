# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ARG PNPM_VERSION=9.12.3
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PNPM_STORE_DIR=/pnpm/store
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip make g++ pkg-config ca-certificates \
  && rm -rf /var/lib/apt/lists/*
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
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @corelia/api... --store-dir /pnpm/store

FROM deps AS builder
COPY . .
RUN pnpm --filter @corelia/types build
RUN pnpm --filter @corelia/api prisma:generate
RUN pnpm --filter @corelia/api build

FROM base AS prod-deps
ARG PRISMA_CLI_VERSION=6.19.2
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY patches ./patches
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @corelia/api... --store-dir /pnpm/store
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm dlx prisma@${PRISMA_CLI_VERSION} generate --schema /app/apps/api/prisma/schema.prisma

FROM node:20-bookworm-slim AS runner
ARG PNPM_VERSION=9.12.3
ARG PRISMA_CLI_VERSION=6.19.2
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate \
  && npm install --global prisma@${PRISMA_CLI_VERSION} \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
