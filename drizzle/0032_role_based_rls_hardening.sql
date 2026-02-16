-- Harden role-based write access on core mutable tables.
-- This aligns RLS with app-level permissions for leads/jobs/invoices.

create or replace function public.app_has_perm(perm text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with me as (
    select role::text as role
    from public.profiles
    where user_id = auth.uid()
    limit 1
  )
  select case
    when perm = 'leads.edit' then
      exists (select 1 from me where role in ('owner', 'admin', 'manager', 'sales', 'staff'))
    when perm = 'jobs.edit' then
      exists (select 1 from me where role in ('owner', 'admin', 'manager'))
    when perm = 'invoices.edit' then
      exists (select 1 from me where role in ('owner', 'admin', 'accountant'))
    else false
  end
$$;

revoke all on function public.app_has_perm(text) from public;
grant execute on function public.app_has_perm(text) to anon, authenticated;

-- Leads write policies
drop policy if exists tenant_can_insert_leads on public.leads;
drop policy if exists tenant_can_update_leads on public.leads;
drop policy if exists tenant_can_delete_leads on public.leads;

create policy tenant_can_insert_leads on public.leads
for insert
with check (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('leads.edit')
);

create policy tenant_can_update_leads on public.leads
for update
using (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('leads.edit')
)
with check (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('leads.edit')
);

create policy tenant_can_delete_leads on public.leads
for delete
using (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('leads.edit')
);

-- Jobs write policies
drop policy if exists tenant_can_insert_jobs on public.jobs;
drop policy if exists tenant_can_update_jobs on public.jobs;
drop policy if exists tenant_can_delete_jobs on public.jobs;

create policy tenant_can_insert_jobs on public.jobs
for insert
with check (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('jobs.edit')
);

create policy tenant_can_update_jobs on public.jobs
for update
using (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('jobs.edit')
)
with check (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('jobs.edit')
);

create policy tenant_can_delete_jobs on public.jobs
for delete
using (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('jobs.edit')
);

-- Invoice write policies
drop policy if exists tenant_can_insert_invoices on public.invoices;
drop policy if exists tenant_can_update_invoices on public.invoices;
drop policy if exists tenant_can_delete_invoices on public.invoices;

create policy tenant_can_insert_invoices on public.invoices
for insert
with check (
  tenant_id = public.app_current_tenant_id()
  and (
    public.app_has_perm('invoices.edit')
    or public.app_has_perm('jobs.edit')
  )
);

create policy tenant_can_update_invoices on public.invoices
for update
using (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('invoices.edit')
)
with check (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('invoices.edit')
);

create policy tenant_can_delete_invoices on public.invoices
for delete
using (
  tenant_id = public.app_current_tenant_id()
  and public.app_has_perm('invoices.edit')
);
