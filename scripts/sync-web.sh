#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-"$ROOT/../jaaykat-api/public"}"
cd "$ROOT"
corepack pnpm build
mkdir -p "$DEST"
find "$DEST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$ROOT/dist/." "$DEST/"
printf 'dist copié vers %s\n' "$DEST"
