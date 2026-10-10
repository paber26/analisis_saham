#!/usr/bin/env bash
#
# Server-side deploy for the Docker setup. Run ON the server, inside the repo:
#   ./scripts/deploy-server.sh            # deploy latest origin/main
#   ./scripts/deploy-server.sh <commit>   # deploy a specific commit
#
# The image is built by GitHub Actions and pushed to GHCR as
# ghcr.io/paber26/analisis_saham:<full-commit-sha>; this script only PULLS it
# (no build on the VPS — it is too small to build without swapping), tags it as
# analisis-saham:latest and restarts the container. Rollback = re-tag the
# previous image, no rebuild.
#
# GitHub Actions (.github/workflows/deploy.yml) calls this over SSH. With the
# deploy key restricted via `command=` in authorized_keys, the requested commit
# arrives in $SSH_ORIGINAL_COMMAND and nothing else can be run with that key.
# Optional stdin: line 1 = registry user, line 2 = short-lived GHCR token (only
# used for this pull, kept in a throw-away docker config, then deleted).
# Only touches this repo and its own image/container — nothing else on the host.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="${CONTAINER:-saham}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
REMOTE_IMAGE="${REMOTE_IMAGE:-ghcr.io/paber26/analisis_saham}"
LOCAL_IMAGE="${LOCAL_IMAGE:-analisis-saham:latest}"   # the name docker-compose.yml runs
IMAGE_LABEL="org.opencontainers.image.source=https://github.com/paber26/analisis_saham"
KEEP_IMAGES=3

REF="${SSH_ORIGINAL_COMMAND:-${1:-origin/main}}"
if [[ "$REF" != "origin/main" && ! "$REF" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "ERROR: ref harus 'origin/main' atau hash commit, bukan: $REF" >&2
  exit 2
fi

GHCR_USER=""
GHCR_TOKEN=""
if [[ ! -t 0 ]]; then
  IFS= read -r -t 10 GHCR_USER || true
  IFS= read -r -t 10 GHCR_TOKEN || true
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

pull_image() {
  local image="$1" cfg rc=0
  if [[ -n "$GHCR_TOKEN" ]]; then
    cfg="$(mktemp -d)"
    printf '%s' "$GHCR_TOKEN" | "${DOCKER[@]}" --config "$cfg" login ghcr.io -u "${GHCR_USER:-github}" --password-stdin >/dev/null || rc=$?
    [[ $rc -eq 0 ]] && { "${DOCKER[@]}" --config "$cfg" pull -q "$image" || rc=$?; }
    rm -rf "$cfg"
    return $rc
  fi
  "${DOCKER[@]}" pull -q "$image"
}

# Start the container from LOCAL_IMAGE, then wait until healthy and serving.
up_and_check() {
  "${DOCKER[@]}" compose up -d --no-build --remove-orphans || return 1
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

# Keep the newest KEEP_IMAGES pulled tags (current + rollback candidates) and
# drop dangling layers of THIS app only (filtered by our OCI source label).
cleanup_images() {
  "${DOCKER[@]}" images "$REMOTE_IMAGE" --format '{{.Repository}}:{{.Tag}}' \
    | tail -n +$((KEEP_IMAGES + 1)) | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true
  "${DOCKER[@]}" image prune -f --filter "label=$IMAGE_LABEL" >/dev/null 2>&1 || true
}

echo "==> Fetch & checkout $REF"
git fetch --prune origin
before="$(git rev-parse --short HEAD)"
before_image="$("${DOCKER[@]}" image inspect -f '{{.Id}}' "$LOCAL_IMAGE" 2>/dev/null || true)"
git checkout --detach "$REF"
sha="$(git rev-parse HEAD)"
after="${sha:0:7}"
echo "    $before -> $after"

image="$REMOTE_IMAGE:$sha"
echo "==> Pull $image"
if ! pull_image "$image"; then
  echo "ERROR: gagal pull $image (sudah di-build oleh GitHub Actions? server login ke ghcr.io?)" >&2
  git checkout --detach "$before" >/dev/null 2>&1 || true
  exit 7
fi
"${DOCKER[@]}" tag "$image" "$LOCAL_IMAGE"

echo "==> Restart container (healthcheck maks ${HEALTH_TIMEOUT}s)"
if up_and_check; then
  cleanup_images
  echo "==> Deploy $after selesai ✅ (healthy, /forecast 200)"
  exit 0
fi

if [[ -n "$before_image" ]]; then
  echo "==> Gagal — rollback ke image sebelumnya ($before)" >&2
  git checkout --detach "$before" >/dev/null 2>&1 || true
  "${DOCKER[@]}" tag "$before_image" "$LOCAL_IMAGE"
  if up_and_check; then
    echo "==> Rollback ke $before berhasil; versi $after TIDAK dipakai" >&2
  else
    echo "==> Rollback juga gagal — cek server manual!" >&2
  fi
fi
exit 5
