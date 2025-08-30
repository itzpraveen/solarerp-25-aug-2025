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
## v0.1.2

- fix(profile): auto-ensure profile on key pages and add owner/admin fix in Settings
  - Leads/Customers/Items/Jobs attempt ensureProfile when missing and retry
  - Jobs detail uses helper for invoice/payment actions
  - Settings → Team: adds "Fix missing profiles" using backfill API
  - Reduces "Profile not ready" occurrences for new or invited users

