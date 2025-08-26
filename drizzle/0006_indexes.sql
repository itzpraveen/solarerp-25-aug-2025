-- Common indexes to improve performance on frequently filtered columns
-- Idempotent: use IF NOT EXISTS to avoid errors on re-apply

-- Tenant-scoped tables
create index if not exists idx_customers_tenant on public.customers(tenant_id);
create index if not exists idx_leads_tenant on public.leads(tenant_id);
create index if not exists idx_jobs_tenant on public.jobs(tenant_id);
create index if not exists idx_proposals_tenant on public.proposals(tenant_id);
create index if not exists idx_items_tenant on public.items(tenant_id);
create index if not exists idx_kits_tenant on public.kits(tenant_id);
create index if not exists idx_invoices_tenant on public.invoices(tenant_id);
create index if not exists idx_payments_tenant on public.payments(tenant_id);
create index if not exists idx_documents_tenant on public.documents(tenant_id);
create index if not exists idx_tasks_tenant on public.tasks(tenant_id);
create index if not exists idx_service_tickets_tenant on public.service_tickets(tenant_id);
create index if not exists idx_background_jobs_tenant on public.background_jobs(tenant_id);
create index if not exists idx_settings_tenant on public.settings(tenant_id);

-- Foreign key and status/date filters
create index if not exists idx_jobs_customer on public.jobs(customer_id);
create index if not exists idx_jobs_status on public.jobs(status);

create index if not exists idx_invoices_job on public.invoices(job_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_due_date on public.invoices(due_date);

create index if not exists idx_payments_invoice on public.payments(invoice_id);

create index if not exists idx_proposals_job on public.proposals(job_id);
create index if not exists idx_proposals_date on public.proposals(date);

create index if not exists idx_documents_job on public.documents(job_id);

create index if not exists idx_tasks_job on public.tasks(job_id);
create index if not exists idx_tasks_status on public.tasks(status);

create index if not exists idx_service_tickets_customer on public.service_tickets(customer_id);
create index if not exists idx_service_tickets_job on public.service_tickets(job_id);
create index if not exists idx_service_tickets_status on public.service_tickets(status);

create index if not exists idx_leads_assigned_to on public.leads(assigned_to);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_date on public.leads(date);

create index if not exists idx_background_jobs_type on public.background_jobs(type);
create index if not exists idx_background_jobs_run_at on public.background_jobs(run_at);

