# Edgegap-ready container image for the SpermRace server (HTTP API + WS on /ws).
#
# Build:
#   docker build -f ops/edgegap/Dockerfile -t spermrace-server:local .
#
# Run locally:
#   docker run --rm -p 8080:8080 -e PORT=8080 spermrace-server:local

FROM node:20-bookworm-slim AS build

WORKDIR /repo

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter shared build
RUN pnpm --filter @skidr/core build
RUN pnpm --filter server build
RUN pnpm --filter server deploy --prod /out
RUN test -f /out/dist/server/src/index.js || (echo "ERROR: dist/server/src/index.js missing from deploy output" && exit 1)


FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /out/ ./

EXPOSE 8080

CMD ["node", "dist/server/src/index.js"]

