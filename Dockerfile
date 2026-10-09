#
# Multi-stage build for the Nuxt 4 / Nitro SSR app.
#   docker compose up -d --build      (see docker-compose.yml)
#
# Persistent data lives under /data (mount a volume there):
#   /data/store  — JSON file store (DATA_STORE_DIR): watchlist, alerts, sims, ...
#   /data/cache  — Nitro API cache (NITRO_CACHE_DIR, baked in at build time)

# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
# nuxt.config.ts reads NITRO_CACHE_DIR at build time and bakes it into .output.
ENV NITRO_CACHE_DIR=/data/cache
COPY package.json package-lock.json ./
# Skip postinstall (`nuxt prepare`) here — sources aren't copied yet; `nuxt build` prepares anyway.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_STORE_DIR=/data/store \
    NITRO_CACHE_DIR=/data/cache
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir -p /data/store /data/cache && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
