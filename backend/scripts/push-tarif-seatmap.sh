#!/usr/bin/env bash
# Dump local tarifs + seat map, then apply them on the VPS Postgres.
#
# Setup once (copy and fill):
#   cp backend/scripts/push-tarif-seatmap.env.example backend/scripts/push-tarif-seatmap.env
#
# Usage:
#   bash backend/scripts/push-tarif-seatmap.sh
#   bash backend/scripts/push-tarif-seatmap.sh --dry-run
#   bash backend/scripts/push-tarif-seatmap.sh --dump-only
#   bash backend/scripts/push-tarif-seatmap.sh --import-local   # import snapshot into CURRENT DATABASE_URL
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
SCRIPT="$BACKEND/scripts/tarif-seatmap.cjs"
SNAPSHOT="$BACKEND/scripts/data/tarif-seatmap-snapshot.json"
ENV_FILE="$BACKEND/scripts/push-tarif-seatmap.env"

DRY_RUN=0
DUMP_ONLY=0
IMPORT_LOCAL=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --dump-only) DUMP_ONLY=1 ;;
    --import-local) IMPORT_LOCAL=1 ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-}"
VPS_PORT="${VPS_PORT:-22}"
VPS_APP_DIR="${VPS_APP_DIR:-/var/www/cowadmin/backend}"
SSH_OPTS=(-p "$VPS_PORT" -o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-P "$VPS_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$VPS_SSH_KEY")
  SCP_OPTS+=(-i "$VPS_SSH_KEY")
fi

echo "==> Dumping local tarifs + seat map"
cd "$BACKEND"
node "$SCRIPT" dump "$SNAPSHOT"

if [[ "$DUMP_ONLY" -eq 1 ]]; then
  echo "Dump only. Snapshot: $SNAPSHOT"
  exit 0
fi

if [[ "$IMPORT_LOCAL" -eq 1 ]]; then
  echo "==> Importing snapshot into local DATABASE_URL"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    node "$SCRIPT" import --dry-run "$SNAPSHOT"
  else
    node "$SCRIPT" import "$SNAPSHOT"
  fi
  exit 0
fi

if [[ -z "$VPS_HOST" || -z "$VPS_USER" ]]; then
  echo "Set VPS_HOST and VPS_USER (env or $ENV_FILE)."
  echo "Example: cp backend/scripts/push-tarif-seatmap.env.example backend/scripts/push-tarif-seatmap.env"
  exit 1
fi

REMOTE_TMP="/tmp/cowadmin-tarif-seatmap"
echo "==> Uploading to ${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}"
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" "mkdir -p $REMOTE_TMP"
scp "${SCP_OPTS[@]}" "$SCRIPT" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}/tarif-seatmap.cjs"
scp "${SCP_OPTS[@]}" "$SNAPSHOT" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}/tarif-seatmap-snapshot.json"

IMPORT_EXTRA=""
if [[ "$DRY_RUN" -eq 1 ]]; then
  IMPORT_EXTRA="--dry-run"
  echo "==> Remote dry-run import"
else
  echo "==> Remote import (uses $VPS_APP_DIR/.env DATABASE_URL)"
fi

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<REMOTE
set -euo pipefail
cd $(printf '%q' "$VPS_APP_DIR")
if [[ ! -d node_modules/@prisma/client ]]; then
  echo "Prisma client missing in $VPS_APP_DIR — deploy the backend first."
  exit 1
fi
node $(printf '%q' "$REMOTE_TMP/tarif-seatmap.cjs") import $IMPORT_EXTRA $(printf '%q' "$REMOTE_TMP/tarif-seatmap-snapshot.json")
REMOTE

echo "Done."
