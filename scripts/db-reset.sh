#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)

mkdir -p "$ROOT/supabase/migrations"
rsync -a --delete "$ROOT/drizzle/" "$ROOT/supabase/migrations/"

echo "Resetting DB and re-applying migrations from supabase/migrations"
npx supabase db reset

