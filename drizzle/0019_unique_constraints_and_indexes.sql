-- Add high-value unique constraints and indexes (idempotent).
-- Catch up schema bits used by the app when only one migration per version is staged.

do $$ begin
  create type program_type as enum ('PM_Surya', 'Commercial');
exception when duplicate_object then null; end $$;

alter table public.jobs
  add column if not exists program_type program_type default 'PM_Surya'::program_type,
  add column if not exists is_loan boolean default false;

alter table public.leads
  add column if not exists next_follow_up_date date,
  add column if not exists last_contacted_at date;

alter table public.settings
  add column if not exists quote_prefix text,
  add column if not exists quote_format text,
  add column if not exists company_name text,
  add column if not exists company_phone text,
  add column if not exists company_email text,
  add column if not exists company_address text,
  add column if not exists company_logo_url text;

alter table public.proposals
  add column if not exists cover jsonb,
  add column if not exists notes jsonb,
  add column if not exists work_schedule jsonb,
  add column if not exists quotation_type text default 'Final';

update public.settings s
set company_name = t.name
from public.tenants t
where s.tenant_id = t.id
  and (s.company_name is null or btrim(s.company_name) = '');

-- Customers: avoid duplicate phone within a tenant (when phone is present)
create unique index if not exists idx_customers_tenant_phone_unique
  on public.customers(tenant_id, phone) where phone is not null;

-- Items: unique item_code per tenant
create unique index if not exists idx_items_tenant_item_code_unique
  on public.items(tenant_id, item_code);

-- Kits: unique kit_name per tenant
create unique index if not exists idx_kits_tenant_name_unique
  on public.kits(tenant_id, kit_name);

-- Branches: unique name per tenant
create unique index if not exists idx_branches_tenant_name_unique
  on public.branches(tenant_id, name);

-- Leads: accelerate follow-up filters and status queries
create index if not exists idx_leads_next_follow_up
  on public.leads(next_follow_up_date);

-- Jobs: status filter
create index if not exists idx_jobs_status
  on public.jobs(status);

-- Invoices: due-date filter and job lookup
create index if not exists idx_invoices_due_date
  on public.invoices(due_date);
create index if not exists idx_invoices_job
  on public.invoices(job_id);

-- Payments: invoice join
create index if not exists idx_payments_invoice
  on public.payments(invoice_id);
