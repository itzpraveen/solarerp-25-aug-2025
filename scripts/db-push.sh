#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DRIZZLE_DIR="$ROOT/drizzle"
MIGR_DIR="$ROOT/supabase/migrations"

mkdir -p "$MIGR_DIR"
rm -f "$MIGR_DIR"/*.sql 2>/dev/null || true

# Stage exactly one migration per version (e.g., 0001, 0002, ...)
declare -A seen
while IFS= read -r -d '' f; do
  base=$(basename "$f")
  ver=${base%%_*}
  # only consider files following NNNN_*.sql pattern
  if [[ $ver =~ ^[0-9]{4}$ ]]; then
    if [[ -z ${seen[$ver]:-} ]]; then
      cp "$f" "$MIGR_DIR/$base"
      seen[$ver]=1
    fi
  fi
done < <(find "$DRIZZLE_DIR" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

echo "Migrations staged under supabase/migrations (one file per version):"
ls -1 "$MIGR_DIR" | nl -ba || true

echo "Running: npx supabase db push"
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  npx supabase db push -p "$SUPABASE_DB_PASSWORD" --yes
else
  npx supabase db push
fi

