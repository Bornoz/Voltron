# Stage 1: Build
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/interceptor/package.json packages/interceptor/
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/ui-simulator/package.json packages/ui-simulator/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/ packages/

RUN pnpm build

# Stage 2: Production
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /opt/voltron

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/interceptor/package.json packages/interceptor/
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/ui-simulator/package.json packages/ui-simulator/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/dashboard/dist packages/dashboard/dist
COPY --from=builder /app/packages/ui-simulator/dist packages/ui-simulator/dist
COPY --from=builder /app/packages/interceptor/dist packages/interceptor/dist

RUN mkdir -p /opt/voltron/data && \
    addgroup -g 1001 voltron && \
    adduser -u 1001 -G voltron -s /bin/sh -D voltron && \
    chown -R voltron:voltron /opt/voltron/data

USER voltron

EXPOSE 8600

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8600/api/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
