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
  - Separate English/Malayalam templates via language selector; files saved with -en/-ml suffix
- Scheduling: Vercel Cron → POST /api/cron/daily
- Messaging: WhatsApp Cloud API
- Tests: Vitest (unit)
- Lint/Format: ESLint + Prettier

## CI/CD

- GitHub Actions
  - Unit tests: `.github/workflows/unit.yml` (Node 20, `npm ci`, `npm run lint`, `npm run test:unit`).
  - CI runs unit tests on push and PRs.
  - Deploy: `.github/workflows/deploy.yml` (optional). If the following repo secrets are set, pushes to `main` deploy to Vercel production and Pull Requests get preview deployments:
    - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
  - Workflows use concurrency to cancel superseded runs per branch.

Note: Never commit a `.env`. Use `.env.example` as the source of truth for required variables and keep secrets only in your local `.env` or CI secrets.

- Pre-commit hook
- `.githooks/pre-commit` runs Prettier check, ESLint on staged files, and unit tests (Vitest).
  - Ensure Git uses repo hooks: `git config core.hookspath .githooks` (already set in this repo).

## Monorepo Layout

- `app/` – Next.js App Router (pages + API routes)
- `src/db/` – Drizzle schema
- `drizzle/` – SQL migrations (RLS + storage policies included)
- `src/lib/` – Utilities (Supabase client, PDF render, queue)
- `components/` – UI components
- `scripts/` – Seeds

## Getting Started

1. Prerequisites

- Supabase project (URL + keys), Auth Email (magic link) and optionally Phone OTP enabled.
- Vercel project connected to this repo.

2. Configure environment

Copy `.env.example` to `.env` and set values:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `DATABASE_URL` (optional, used for Drizzle push)
- `CRON_SECRET` (used by Vercel cron to authenticate)
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`

3. Apply migrations and policies

Use Supabase SQL Editor or Drizzle push:

- Paste and run `drizzle/0001_init.sql` in Supabase SQL editor (recommended)
- Or run: `pnpm db:migrate` (requires `DATABASE_URL` with service role Postgres)

4. Create Storage bucket (if not created by migration)

- Migration inserts `storage.buckets` row for `documents`. If missing, create bucket `documents` (private = false unchecked) and run the Storage RLS policies in `drizzle/0001_init.sql`.

5. Development

- `pnpm i`
- `pnpm dev`
- Visit `http://localhost:3000`
- Sign in via magic link or phone OTP at `/auth/signin`

On first login, the app auto-creates a `tenant`, `profile`, and default `settings` for your user.

### Scripts

Kept minimal for clarity:

- `dev`, `build`, `start`, `lint`, `format`, `test`, and `db:*`

Verify server is healthy: `GET /api/health` should return `{ ok: true }`.

6. Deploy to Vercel

- Import repo into Vercel
- Add env vars listed above in Vercel → Project Settings → Environment Variables
- Ensure `vercel.json` is present; it grants extra memory/duration to the PDF function and configures a cron at 03:00 UTC.
- Set a cron secret and configure Vercel Cron to call `POST /api/cron/daily` with `Authorization: Bearer $CRON_SECRET`

### Supabase Auth URL Configuration (Important)

After connecting your Supabase project, set these in Supabase → Authentication → URL Configuration:

- Site URL: your production domain, e.g. `https://<your-project>.vercel.app` (or your custom domain)
- Additional Redirect URLs: include your production domain(s) and `http://localhost:3000` for development

Magic-link login uses these values. If not set, links may redirect to `http://localhost:3000` on production.

### Mock Mode and Demo UI

For local demos, a mock in-memory backend can be enabled.

- `NEXT_PUBLIC_E2E_MOCK=1`: enable mock backend (no network calls).
- `NEXT_PUBLIC_DEMO_UI=1`: show “Demo quick sign-in” buttons on `/auth/signin`.

Notes:

- In mock mode, the app starts with no session by default; click a demo sign-in button to authenticate.
- For production/staging, do not set these flags.

## Data Model

See `drizzle/0001_init.sql` and `src/db/schema.ts` for enums and tables. Highlights:

- UUID primary keys (`gen_random_uuid()`), timestamps as `timestamptz` with default `now()`
- RLS for every business table: tenant can read/modify rows matching their `profiles.tenant_id`
- `profiles` row-level policies restrict user to their own row
- Storage RLS restricts to bucket `documents` with object keys prefixed by `tenant_id/`

Cross-schema FK: `profiles.user_id → auth.users(id) on delete cascade` (in migration).

## User Roles & Permissions

The app supports multiple roles per tenant via `profiles.role`:

- Owner: full access; can manage Settings, Team, Items, Kits.
- Admin: same as Owner for day-to-day ops, including Team/Settings.
- Manager: manage Jobs/Leads/Service; view Invoices.
- Sales: manage Leads; view Jobs.
- Technician: view assigned Service/Jobs; update own service notes.
- Accountant: manage Invoices/Payments.
- Viewer: read-only across most modules.
- Staff (legacy): general staff role retained for backward compatibility.

Policies enforce that only Owner/Admin can write to Items, Kits, and Settings. Other tables remain tenant-scoped via RLS.

Migrations:

- Apply `drizzle/0011_rbac_roles.sql` to expand the `role` enum and broaden owner-only policies to also allow Admin.
- If your migration runner wraps statements in a transaction and `ALTER TYPE ... ADD VALUE` fails, run the file in Supabase SQL Editor.

## PDF Long Invoice/Quotation

- HTML renderer: `src/lib/renderLongInvoiceHtml.ts` (exact implementation per spec)
- API: `POST /api/pdf/invoice` → renders PDF with Puppeteer and uploads to Supabase Storage bucket `documents/tenant_id/...`, returns a 7-day signed URL.

Vercel function runtime: configured via `vercel.json` to use 1024MB/60s for the PDF route.

### Troubleshooting PDF generation

- Local dev: install Google Chrome and set `PUPPETEER_EXECUTABLE_PATH` (or `CHROME_PATH`) to the Chrome binary. Alternatively, install `puppeteer` to allow a bundled Chromium in dev.
- Serverless (Vercel/AWS): keep `@sparticuz/chromium` as a dependency. Optionally set `PUPPETEER_EXECUTABLE_PATH=/var/task/node_modules/@sparticuz/chromium/bin/chromium`.
- Prebuilt Chromium: host a tarball and set `CHROMIUM_PACK_URL` (or `CHROMIUM_MIN_PACK_URL`) to its URL.
- Malayalam fonts: set `NEXT_PUBLIC_ML_FONT_URL` to a TTF served by your app or set `PDF_ML_FONT_BASE64`.
- If errors occur, the API responds with `{ ok: false, id, cause }`. For local flows/tests, set `NEXT_PUBLIC_E2E_MOCK=1` to bypass real rendering.

### Example Payload (for quick test)

POST `http://localhost:3000/api/pdf/invoice`

```
{
  "tenantId": "6f3df3d0-1111-2222-3333-444455556666",
  "payload": {
    "lang": "en",
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

Optional extensions supported by the renderer (use only what you need):

- `cover`: { `to`, `subject`, `reference`, `paragraphs[]`, `signatory` } — cover letter page (auto-subject falls back to “Quotation for <kW> <system> … (PMSG Subsidy)” for PM Surya).
- `workSchedule`: rows of `{ scope, details, timeline }` — tabular schedule page.
- `notes[]`: extra bullet notes (e.g., production estimates, inclusions/exclusions).

See `tmp/q19_harilal_payload.json` for a real-world example based on the client “Harilal, Mampad”.

### Malayalam Font (optional, recommended)

To ensure Malayalam text renders correctly on PDFs, provide a font:

- Add the TTF under `public/fonts/NotoSansMalayalam-Regular.ttf` and set `NEXT_PUBLIC_ML_FONT_URL=https://<your-domain>/fonts/NotoSansMalayalam-Regular.ttf`, or
- Set `PDF_ML_FONT_BASE64` to the base64 of the TTF (large; URL is preferred).

Renderer automatically embeds this font when `payload.lang` is `"ml"`. Generated PDFs are saved with `-en`/`-ml` suffixes.

Local dev fallback: if neither env is set and `NODE_ENV !== 'production'`, the renderer uses `http://localhost:3000/fonts/NotoSansMalayalam-Regular.ttf` automatically. Place the TTF in `public/fonts/` for this to work.

### Proposals Language Column

`proposals.lang` tracks the language used to generate the PDF.

- SQL: `drizzle/0002_add_proposals_lang.sql` (apply in Supabase SQL editor), or
- Run Drizzle push after updating `schema.ts`.

### Base URL Helper

Server code that calls internal APIs uses a central base URL resolver:

- `src/lib/baseUrl.ts` reads `NEXT_PUBLIC_BASE_URL`, `VERCEL_URL`, or falls back to `http://localhost:3000`.
- Set `NEXT_PUBLIC_BASE_URL` in Vercel to your canonical origin for reliable internal calls.

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

### Manual QA Checklist

- Auth:
  - Production (invite-only): set `ALLOW_SELF_SIGNUP=0` and `NEXT_PUBLIC_ALLOW_SELF_SIGNUP=0` (Vercel env), disable "Email signups" in Supabase Auth. New users must be invited from Settings → Team & Roles. First login does not create a tenant.
  - Demo/dev (open signup): set both to `1`. First login auto-creates a new tenant and owner profile.
  - Sign in at `/auth/signin` using magic link or phone OTP.
- Customers: Add a customer; open detail; create a job.
- Jobs: Kanban visible; drag status; open job; edit Overview fields and Save; Proposals tab → generate PDF; Docs tab → upload; Tasks tab → add task.
- Leads: Add a lead; Edit a row; Convert → creates customer + job and redirects.
- Items/Kits: Owner can add/edit; staff read-only.
- Proposals: List shows signed links; open PDF; share via WhatsApp (requires WhatsApp env vars and template).
- Cron: `POST /api/cron/daily` with `Authorization: Bearer $CRON_SECRET` updates overdue invoices, enqueues reminders, and processes due jobs.

### Tenant Cleanup (Admin)

Remove a tenant and its stored documents:

1. Ensure envs are set: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role).
2. Delete by name or id:

- By name: `SEED_TENANT_NAME="Demo Tenant" npm run tenant:delete` (or `npm run tenant:delete -- --name "Demo Tenant"`)
- By id: `SEED_TENANT_ID="<tenant-uuid>" npm run tenant:delete` (or `npm run tenant:delete -- --tenant <uuid>`)

The script removes all objects under `documents/<tenant_id>/` (batched), then deletes the row from `tenants` (cascades via FKs).

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
