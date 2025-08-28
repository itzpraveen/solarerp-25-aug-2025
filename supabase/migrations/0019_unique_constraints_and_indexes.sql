-- Add high-value unique constraints and indexes (idempotent).

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

