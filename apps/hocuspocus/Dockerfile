FROM node:20-alpine
ARG PNPM_VERSION=9.12.3
RUN npm config set fetch-retries 8 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches ./patches
COPY apps/hocuspocus/package.json apps/hocuspocus/package.json

RUN pnpm install --frozen-lockfile --filter @corelia/hocuspocus...

COPY apps/hocuspocus ./apps/hocuspocus

EXPOSE 1234
CMD ["node", "apps/hocuspocus/server.js"]
