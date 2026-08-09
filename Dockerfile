# syntax=docker/dockerfile:1.7
FROM node:22.14-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl util-linux

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN pnpm prisma:generate && pnpm build

# Migration intentionally uses the complete dependency graph. It is a short-lived
# service, never the web runtime image.
FROM build AS migrator
ENV NODE_ENV=production
CMD ["pnpm", "db:migrate:deploy"]

FROM build AS validator
ENV NODE_ENV=production
CMD ["pnpm", "env:check:docker"]

FROM minio/mc:RELEASE.2025-04-16T18-13-26Z AS mc

FROM alpine:3.21 AS backup
RUN apk add --no-cache bash ca-certificates coreutils findutils openssl postgresql17-client tar util-linux
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs ops
COPY --from=mc /usr/bin/mc /usr/local/bin/mc
COPY deploy/backup/backup.sh deploy/backup/restore.sh /backup/
RUN chmod 0755 /backup/backup.sh /backup/restore.sh
USER 1001:1001
ENTRYPOINT ["/backup/backup.sh"]

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Next's standalone output is dependency-traced; do not hard-code pnpm store paths.
COPY --from=build --chown=nextjs:nodejs /app/deploy/ops ./deploy/ops
RUN chmod 0755 ./deploy/ops/cron-runner.sh
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
