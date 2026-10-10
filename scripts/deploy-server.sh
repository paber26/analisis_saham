#!/usr/bin/env bash
#
# Server-side deploy for the Docker setup. Run ON the server, inside the repo:
#   ./scripts/deploy-server.sh            # deploy latest origin/main
#   ./scripts/deploy-server.sh <commit>   # deploy a specific commit
#
# GitHub Actions (.github/workflows/deploy.yml) calls this over SSH. With the
# deploy key restricted via `command=` in authorized_keys, the requested commit
# arrives in $SSH_ORIGINAL_COMMAND and nothing else can be run with that key.
# Only touches this repo and its own compose project — nothing else on the host.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="${CONTAINER:-saham}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

REF="${SSH_ORIGINAL_COMMAND:-${1:-origin/main}}"
if [[ "$REF" != "origin/main" && ! "$REF" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "ERROR: ref harus 'origin/main' atau hash commit, bukan: $REF" >&2
  exit 2
fi

cd "$REPO_DIR"

# One deploy at a time.
exec 9>"$REPO_DIR/.deploy.lock"
if ! flock -n 9; then
  echo "ERROR: deploy lain sedang berjalan" >&2
  exit 3
fi

# Use plain docker if this user may, else passwordless sudo.
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1; then DOCKER=(sudo -n docker); else
    echo "ERROR: user $(id -un) tidak bisa menjalankan docker (tambahkan ke grup docker)" >&2
    exit 4
  fi
fi

echo "==> Fetch & checkout $REF"
git fetch --prune origin
before="$(git rev-parse --short HEAD)"
git checkout --detach "$REF"
after="$(git rev-parse --short HEAD)"
echo "    $before -> $after"

# Build + start, then wait until the container is healthy and serving.
up_and_check() {
  "${DOCKER[@]}" compose up -d --build --remove-orphans || return 1
  local status="" code=""
  for ((i = 0; i < HEALTH_TIMEOUT; i += 5)); do
    status="$("${DOCKER[@]}" inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
    [[ "$status" == "healthy" || "$status" == "unhealthy" || "$status" == "missing" ]] && break
    sleep 5
  done
  if [[ "$status" != "healthy" ]]; then
    echo "ERROR: container $CONTAINER status '$status'" >&2
    "${DOCKER[@]}" logs --tail 50 "$CONTAINER" >&2 || true
    return 1
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://127.0.0.1:3200/forecast || true)"
  if [[ "$code" != "200" ]]; then
    echo "ERROR: /forecast mengembalikan HTTP $code" >&2
    return 1
  fi
}

echo "==> Build & restart container (healthcheck maks ${HEALTH_TIMEOUT}s)"
if up_and_check; then
  echo "==> Deploy $after selesai ✅ (healthy, /forecast 200)"
  exit 0
fi

if [[ "$before" != "$after" ]]; then
  echo "==> Gagal — rollback ke $before" >&2
  git checkout --detach "$before"
  if up_and_check; then
    echo "==> Rollback ke $before berhasil; versi $after TIDAK dipakai" >&2
  else
    echo "==> Rollback juga gagal — cek server manual!" >&2
  fi
fi
exit 5
