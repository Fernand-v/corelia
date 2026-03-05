FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY patches ./patches
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_API_KEY=""
ARG NEXT_PUBLIC_HOCUSPOCUS_URL=""
ARG NEXT_PUBLIC_DOCS_DEBUG="false"
ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
ENV NEXT_PUBLIC_HOCUSPOCUS_URL=${NEXT_PUBLIC_HOCUSPOCUS_URL}
ENV NEXT_PUBLIC_DOCS_DEBUG=${NEXT_PUBLIC_DOCS_DEBUG}
COPY . .
RUN node scripts/check-peers-caller-patch.mjs
RUN pnpm --filter @corelia/types build
RUN pnpm --filter @corelia/ui build
RUN pnpm --filter @corelia/web build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=builder /app/packages/ui/dist ./packages/ui/dist
COPY --from=builder /app/packages/ui/package.json ./packages/ui/package.json
COPY --from=builder /app/packages/ui/node_modules ./packages/ui/node_modules
EXPOSE 3000
CMD ["pnpm", "--filter", "@corelia/web", "start"]
