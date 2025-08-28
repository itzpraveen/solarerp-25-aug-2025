#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)

mkdir -p "$ROOT/supabase/migrations"
rsync -a --delete "$ROOT/drizzle/" "$ROOT/supabase/migrations/"

echo "Migrations staged under supabase/migrations" 
echo "Running: npx supabase db push"
npx supabase db push

