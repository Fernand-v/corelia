FROM node:20-alpine AS base
RUN apk add --no-cache python3 py3-pip make g++ linux-headers
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @corelia/types build
RUN pnpm --filter @corelia/api prisma:generate
RUN pnpm --filter @corelia/api build

FROM node:20-alpine AS runner
RUN apk add --no-cache libstdc++
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/node_modules ./packages/types/node_modules
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
