-- Branches table and branch_id references on leads/jobs

-- Create branches table (idempotent)
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Enable RLS and basic tenant policies on branches
alter table public.branches enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname = 'tenant_can_select_branches'
  ) then
    execute 'create policy tenant_can_select_branches on public.branches for select using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname = 'tenant_can_insert_branches'
  ) then
    execute 'create policy tenant_can_insert_branches on public.branches for insert with check (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname = 'tenant_can_update_branches'
  ) then
    execute 'create policy tenant_can_update_branches on public.branches for update using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname = 'tenant_can_delete_branches'
  ) then
    execute 'create policy tenant_can_delete_branches on public.branches for delete using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
end $$;

-- Add branch_id to leads and jobs (nullable for backward compatibility)
alter table public.leads add column if not exists branch_id uuid;
alter table public.jobs  add column if not exists branch_id uuid;

-- Add FKs if missing (on delete set null)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_branch_fk'
  ) then
    alter table public.leads add constraint leads_branch_fk foreign key (branch_id) references public.branches(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_branch_fk'
  ) then
    alter table public.jobs add constraint jobs_branch_fk foreign key (branch_id) references public.branches(id) on delete set null;
  end if;
end $$;

-- Helpful indexes
create index if not exists idx_leads_branch on public.leads(branch_id);
create index if not exists idx_jobs_branch on public.jobs(branch_id);

