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

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY patches ./patches
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @corelia/web... --store-dir /pnpm/store

FROM deps AS builder
ARG NEXT_PUBLIC_API_URL="/api/v1"
ARG NEXT_PUBLIC_WS_URL=""
ARG NEXT_PUBLIC_SOCKET_PATH="/ws/socket.io"
ARG NEXT_PUBLIC_HOCUSPOCUS_URL=""
ARG NEXT_PUBLIC_DOCS_DEBUG="false"
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_SOCKET_PATH=${NEXT_PUBLIC_SOCKET_PATH}
ENV NEXT_PUBLIC_HOCUSPOCUS_URL=${NEXT_PUBLIC_HOCUSPOCUS_URL}
ENV NEXT_PUBLIC_DOCS_DEBUG=${NEXT_PUBLIC_DOCS_DEBUG}
COPY . .
RUN node scripts/check-peers-caller-patch.mjs
RUN pnpm --filter @corelia/types build
RUN pnpm --filter @corelia/ui build
RUN --mount=type=cache,id=next-cache,target=/app/apps/web/.next/cache \
  pnpm --filter @corelia/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
WORKDIR /app/apps/web
# Ejecutar como usuario no-root (incluido en la imagen oficial de node).
USER node
EXPOSE 3000
CMD ["node", "server.js"]
