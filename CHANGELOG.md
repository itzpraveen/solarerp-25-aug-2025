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

## v0.1.3

- feat(customers): server-side pagination, debounced search, sorting
  - Adds pager, page-size selector and sort options (recent, name A–Z/Z–A)
  - Loads only required columns; auth-gated loading to avoid noisy 401s
  - Export CSV now reflects the current page/filters
- feat(db): customers trigram indexes for fast contains search
  - Adds `pg_trgm` extension and GIN indexes on name/phone/email
  - Improves ILIKE `%term%` queries used by Customers search

## v0.1.4

- perf: paginate Items/Proposals/Service; narrow selects; debounced search
  - Items: paging + sorting; search across code/name/vendor
  - Proposals: paging + search + row count controls
  - Service: paging + summary search
- perf(overview): fewer round trips
  - New API `GET /api/overview/kpis` consolidates leads KPIs and proposals WTD/MTD
  - Overview now uses join filters for invoices/proposals/payments/tasks
- perf(header): counts use join filters (no jobs prefetch)
- perf(db): indexes for `leads.next_follow_up_date` (+ composite by branch) and `tasks.due_date`
