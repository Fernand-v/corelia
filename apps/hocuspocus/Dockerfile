FROM node:20-alpine
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches ./patches
COPY apps/hocuspocus/package.json apps/hocuspocus/package.json

RUN pnpm install --frozen-lockfile --filter @corelia/hocuspocus...

COPY apps/hocuspocus ./apps/hocuspocus

EXPOSE 1234
CMD ["pnpm", "--filter", "@corelia/hocuspocus", "start"]
