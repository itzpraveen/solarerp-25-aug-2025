-- Exclude soft-deleted customers from normal SELECT via RLS.
do $$
begin
  -- Drop generic tenant select policy if present
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers' and policyname = 'tenant_can_select_customers'
  ) then
    execute 'drop policy tenant_can_select_customers on public.customers';
  end if;
  -- Create refined policy that omits deleted rows
  execute 'create policy tenant_can_select_customers on public.customers for select using (
    tenant_id = public.app_current_tenant_id() and deleted_at is null
  )';
end $$;

