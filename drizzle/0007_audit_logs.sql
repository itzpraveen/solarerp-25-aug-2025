-- Audit logs table and basic RLS policies

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_audit_tenant on public.audit_logs(tenant_id);
create index if not exists idx_audit_action on public.audit_logs(action);
create index if not exists idx_audit_created_at on public.audit_logs(created_at);

-- Enable RLS and allow tenant-scoped access
alter table public.audit_logs enable row level security;

-- Idempotent policy creation for select/insert
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='tenant_can_select_audit_logs'
  ) then
    execute 'create policy tenant_can_select_audit_logs on public.audit_logs for select using (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
    )';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='tenant_can_insert_audit_logs'
  ) then
    execute 'create policy tenant_can_insert_audit_logs on public.audit_logs for insert with check (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
    )';
  end if;
end $$;

