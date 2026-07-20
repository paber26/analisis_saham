#!/usr/bin/env bash
#
# Deploy analisis_saham (Nuxt/Nitro SSR) to the production server.
# Routine update: `./deploy.sh`  (builds locally, ships .output, restarts PM2)
#
# Config is read from .deploy.env (gitignored). See .deploy.env.example.
# One-time server setup is documented in DEPLOY.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.deploy.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

DEPLOY_HOST="${DEPLOY_HOST:?set DEPLOY_HOST in .deploy.env}"
DEPLOY_USER="${DEPLOY_USER:-kuydinas}"
DEPLOY_PATH="${DEPLOY_PATH:-/www/wwwroot/saham.kuydinas.id}"
DEPLOY_PORT="${DEPLOY_PORT:-3200}"
PM2_NAME="${PM2_NAME:-saham}"

# SSH auth: prefer key-based; fall back to sshpass only if DEPLOY_PASSWORD is set.
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=20"
if [ -n "${DEPLOY_PASSWORD:-}" ]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "ERROR: DEPLOY_PASSWORD is set but 'sshpass' is not installed (brew install sshpass)." >&2
    exit 1
  fi
  SSH_BIN=(sshpass -p "$DEPLOY_PASSWORD" ssh $SSH_OPTS)
  RSH="sshpass -p $DEPLOY_PASSWORD ssh $SSH_OPTS"
else
  SSH_BIN=(ssh $SSH_OPTS)
  RSH="ssh $SSH_OPTS"
fi

echo "==> [1/3] Building production bundle..."
npm run build

echo "==> [2/3] Uploading .output to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH} ..."
rsync -az --delete -e "$RSH" "$SCRIPT_DIR/.output/" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/.output/"

echo "==> [3/3] Clearing day-cache + (re)starting PM2 app '${PM2_NAME}' on port ${DEPLOY_PORT} ..."
# Clear the persistent cache on deploy so changed logic takes effect immediately
# (between deploys the cache persists and refreshes once per day).
SYNC_TOKEN="${SYNC_TOKEN:-saham-sync}"
"${SSH_BIN[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "cd ${DEPLOY_PATH} && rm -rf .cache && (SYNC_TOKEN='${SYNC_TOKEN}' PORT=${DEPLOY_PORT} HOST=127.0.0.1 pm2 restart ${PM2_NAME} --update-env || SYNC_TOKEN='${SYNC_TOKEN}' PORT=${DEPLOY_PORT} HOST=127.0.0.1 pm2 start .output/server/index.mjs --name ${PM2_NAME} --update-env) && pm2 save >/dev/null"

echo "==> Done ✅  https://saham.kuydinas.id"
