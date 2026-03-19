# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ARG PNPM_VERSION=9.12.3
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

FROM base AS prod-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches ./patches
COPY apps/hocuspocus/package.json apps/hocuspocus/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @corelia/hocuspocus... --store-dir /pnpm/store

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/hocuspocus/node_modules ./apps/hocuspocus/node_modules
COPY apps/hocuspocus ./apps/hocuspocus

WORKDIR /app/apps/hocuspocus
EXPOSE 1234
CMD ["node", "server.js"]
