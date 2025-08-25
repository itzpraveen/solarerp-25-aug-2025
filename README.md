# SolarERP (Kerala) – MVP

Minimal, multi-tenant ERP for a solo solar entrepreneur in Kerala. Built with Next.js 15 (App Router), Supabase (Postgres + Auth + Storage), Drizzle ORM, Tailwind, and Puppeteer for multi-page “long invoice / quotation” PDFs. WhatsApp Cloud API integration allows sharing proposal/invoice links.

## Features

- Multi-tenant with RLS keyed by `tenant_id`
- Pipeline: Lead → Qualified → Quoted → Won → KSEB Submitted → Installed → Net-Metered → Handover → Closed/Lost
- Templatized multi-page PDF quotation/invoice (Estimate, BOQ, Terms, Warranty, Bank/UPI, etc.)
- WhatsApp template sends via Cloud API
- Storage with tenant-prefixed keys `tenant_id/...` and strict policies
- Cron job to mark overdue invoices and enqueue reminders
- Auto deposit invoice on moving a Job to Won (percentage from Settings)
- Mobile-first UI with Kanban, forms, and basic tabs per Job

## Tech Stack

- Frontend: Next.js 15 (App Router), TypeScript, Tailwind
- Backend: Supabase (Postgres + Auth + Storage + Realtime)
- ORM/Migrations: Drizzle ORM + drizzle-kit (SQL migrations included)
- PDF: Puppeteer + @sparticuz/chromium-min in a Vercel Node Function
- Scheduling: Vercel Cron → POST /api/cron/daily
- Messaging: WhatsApp Cloud API
- Tests: Vitest (unit), Playwright (smoke)
- Lint/Format: ESLint + Prettier

## Monorepo Layout

- `app/` – Next.js App Router (pages + API routes)
- `src/db/` – Drizzle schema
- `drizzle/` – SQL migrations (RLS + storage policies included)
- `src/lib/` – Utilities (Supabase client, PDF render, queue)
- `components/` – UI components
- `scripts/` – Seeds

## Getting Started

1) Prerequisites
- Supabase project (URL + keys), Auth Email (magic link) and optionally Phone OTP enabled.
- Vercel project connected to this repo.

2) Configure environment

Copy `.env.example` to `.env` and set values:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `DATABASE_URL` (optional, used for Drizzle push)
- `CRON_SECRET` (used by Vercel cron to authenticate)
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`

3) Apply migrations and policies

Use Supabase SQL Editor or Drizzle push:

- Paste and run `drizzle/0001_init.sql` in Supabase SQL editor (recommended)
- Or run: `pnpm db:migrate` (requires `DATABASE_URL` with service role Postgres)

4) Create Storage bucket (if not created by migration)

- Migration inserts `storage.buckets` row for `documents`. If missing, create bucket `documents` (private = false unchecked) and run the Storage RLS policies in `drizzle/0001_init.sql`.

5) Development

- `pnpm i`
- `pnpm dev`
- Visit `http://localhost:3000`
- Sign in via magic link or phone OTP at `/auth/signin`

On first login, the app auto-creates a `tenant`, `profile`, and default `settings` for your user.

### Demo Data (optional)

To quickly populate realistic demo data:

- Minimal: `npm run seed` – adds one customer/job/proposal/invoice
- Full: `npm run seed:full` – seeds items, kits, kit items, customers, jobs across statuses, proposals, invoices, payments, service tickets, tasks, and leads.

Both require env vars: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. You can optionally pass `SEED_TENANT_ID` to seed into an existing tenant.

Verify server is healthy: `GET /api/health` should return `{ ok: true }`.

6) Deploy to Vercel

- Import repo into Vercel
- Add env vars listed above in Vercel → Project Settings → Environment Variables
- Ensure `vercel.json` is present; it grants extra memory/duration to the PDF function and configures a cron at 03:00 UTC.
- Set a cron secret and configure Vercel Cron to call `POST /api/cron/daily` with `Authorization: Bearer $CRON_SECRET`

## Data Model

See `drizzle/0001_init.sql` and `src/db/schema.ts` for enums and tables. Highlights:

- UUID primary keys (`gen_random_uuid()`), timestamps as `timestamptz` with default `now()`
- RLS for every business table: tenant can read/modify rows matching their `profiles.tenant_id`
- `profiles` row-level policies restrict user to their own row
- Storage RLS restricts to bucket `documents` with object keys prefixed by `tenant_id/`

Cross-schema FK: `profiles.user_id → auth.users(id) on delete cascade` (in migration).

## PDF Long Invoice/Quotation

- HTML renderer: `src/lib/renderLongInvoiceHtml.ts` (exact implementation per spec)
- API: `POST /api/pdf/invoice` → renders PDF with Puppeteer and uploads to Supabase Storage bucket `documents/tenant_id/...`, returns a 7-day signed URL.

Vercel function runtime: configured via `vercel.json` to use 1024MB/60s for the PDF route.

### Example Payload (for quick test)

POST `http://localhost:3000/api/pdf/invoice`

```
{
  "tenantId": "6f3df3d0-1111-2222-3333-444455556666",
  "payload": {
    "company": { "name": "Tenaga Energy Solutions LLP", "address": "Malappuram, Kerala", "phone": "+91-98xxxxxxx", "email": "sales@tenaga.example", "upi": "tenaga@upi" },
    "customer": { "name": "Harilal", "phone": "+91-9xxxxxxxxx", "place": "Mampad", "address": "Mampad PO" },
    "meta": { "quoteNo": "Q19_5KW_SOLAR_PLANT_Harilal_Mampad", "dateISO": "2025-06-21", "validTillISO": "2025-07-01", "program": "PM Surya", "systemCategory": "On-grid", "plantBrand": "Havells", "capacityKW": 5 },
    "money": { "currency": "INR", "projectCost": 265000, "addOns": [ { "label": "UG Cable & Copper", "amount": 12000 }, { "label": "Walkway", "amount": 8000 }, { "label": "Panel Board", "amount": 15000 } ], "taxRatePct": 0 },
    "pipeline": { "leadAt": "2025-06-21", "followUpAt": "2025-06-22", "quotedAt": "2025-06-23", "reminders": [ { "label": "Explain proposal", "dueISO": "2025-06-24" }, { "label": "KSEB feasibility follow‑up", "dueISO": "2025-07-05" } ] },
    "boq": { "rows": [ { "item": "Bifacial PV Modules 550–600 Wp", "qty": "8", "unit": "Nos", "make": "Havells" }, { "item": "On‑grid Inverter 5 kW", "qty": "1", "unit": "Nos", "make": "Havells" }, { "item": "ACDB / DCDB", "qty": "1", "unit": "Set", "make": "Havells" }, { "item": "Solar Cable 4/6 sqmm", "qty": "As required", "unit": "RM" }, { "item": "Earthing & LA", "qty": "As required" }, { "item": "MMS (GI/Alu) with fasteners", "qty": "As required" } ] },
    "assumptions": [ "Shadow‑free area available; roof made ready by client.", "KSEB/Inspectorate fees, application charges under customer scope.", "Water & electricity for installation under customer scope." ],
    "warranty": [ "Modules: 10‑year product & 25‑year performance warranty (as per OEM).", "Inverter: 10‑year standard warranty (as per OEM).", "Electrical interconnections: 5‑year workmanship warranty." ],
    "priceSchedule": { "lines": [ { "label": "KSEB Registration/Feasibility", "amount": 47200, "note": "80% refundable by KSEB (as applicable)" }, { "label": "Net Meter (CT), if not available", "amount": 40000 } ], "offerValidityDays": 10 },
    "paymentTerms": ["70% Advance", "20% on installation", "10% on commissioning"],
    "bank": { "accountName": "Tenaga Energy Solutions LLP", "accountNo": "50200074457195", "ifsc": "HDFC00006736", "bank": "HDFC", "branch": "Udma" },
    "signatures": { "preparedBy": "Shagufta", "contactPerson": "Shaju Ummer", "contactNumber": "7012599968" },
    "malayalamNote": "ഇത് ഒരു പ്രാഥമിക ക്വോട്ടേഷനാണ്; സൈറ്റിന്റെ അന്തിമ പരിശോധനയ്ക്ക് ശേഷം ചെറിയ മാറ്റങ്ങൾ വരാം."
  }
}
```

## WhatsApp Cloud API

- API: `POST /api/whatsapp/send` with `{ to, templateName, variables }` → posts to Facebook Graph API using Bearer token
- Webhook: `POST /api/webhooks/whatsapp` (GET for verification with `WHATSAPP_VERIFY_TOKEN`)

Templates expected:
- `proposal_ready`: Hi {{1}}, your solar proposal ({{2}} kW) is ready: {{3}}
- `invoice_due`: Hello {{1}}, your invoice {{2}} for ₹{{3}} is due on {{4}}. Link: {{5}}

## Cron + Background Jobs

- `POST /api/cron/daily` secured by `Authorization: Bearer ${CRON_SECRET}`
- Marks invoices as Overdue by `due_date < today` and `status != Paid`
- Enqueues reminders (example payload included)
- Creates follow-up tasks 7/14 days after `date_kseb_submit` if status is unchanged
- Processes simple job queue with retries (exponential backoff)

## Acceptance Notes

- RLS enforces multi-tenant access using `profiles.tenant_id`
- Storage policies only permit `documents` objects with `tenant_id/` prefix; server-generated signed URLs are returned by the PDF API
- Jobs Kanban allows drag→drop; moving to Won calls a server route to auto-create a Deposit invoice based on Settings
- Job Overview allows editing dates (survey/KSEB submit/install/net meter/handover), location, KSEB application no, subsidy ref, and notes. Status dropdown auto-fills relevant dates.
- Lighthouse: mobile-first Tailwind styles; no severe accessibility/SEO failures expected

## Testing

- Unit: `pnpm test` – checks PDF HTML generator
- E2E: `pnpm test:e2e` – basic smoke that root redirects to `/jobs`

### Manual QA Checklist

- Auth: Sign in via magic link/phone at `/auth/signin`; `POST /api/auth/ensureProfile` creates your tenant/profile/settings on first login.
- Customers: Add a customer; open detail; create a job.
- Jobs: Kanban visible; drag status; open job; edit Overview fields and Save; Proposals tab → generate PDF; Docs tab → upload; Tasks tab → add task.
- Leads: Add a lead; Edit a row; Convert → creates customer + job and redirects.
- Items/Kits: Owner can add/edit; staff read-only.
- Proposals: List shows signed links; open PDF; share via WhatsApp (requires WhatsApp env vars and template).
- Cron: `POST /api/cron/daily` with `Authorization: Bearer $CRON_SECRET` updates overdue invoices, enqueues reminders, and processes due jobs.

## One-click Deploy

- Push to GitHub, import into Vercel, configure env vars, connect to Supabase
- Migrate schema with `drizzle/0001_init.sql`
- Ready. PDF function memory/time is defined in `vercel.json`.

## Notes

- Monetary fields are `numeric(12,2)`; UI uses `en-IN` formatting
- GST logic is configurable in Settings – no hardcoding
- Storage uploads always use keys prefixed with `tenant_id/`
- Data access via Supabase JS with RLS; Drizzle used for schema and migrations
- Malayalam note is included from Settings when generating proposals
