## v0.1.1

- feat(pdf): correct client name; show Address; UI polish
  - Fix jobs→customers mapping (avoid "Customer" placeholder)
  - Always label Address; support multi‑line; include phone/email when present
  - Header polish: lighter watermark, improved chips, cost summary
- feat(db): add 0026 backfill for settings.company_name
  - Idempotent update from tenants.name when NULL/blank
- chore(db): db:push stages one file per version and supports SUPABASE_DB_PASSWORD
  - Dedupe staging from drizzle → supabase/migrations
  - Non‑interactive push via env var; updated staged layout

