-- Task templates and dependencies for stage-driven workflows
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  label text not null,
  milestone text not null,
  at_stage_trigger text not null,
  due_days int default 2,
  role text not null,
  loan_only boolean default false,
  program_required text,
  required boolean default true,
  docs_required jsonb default '[]',
  checklist text default '',
  gates_stage text default null,
  unique(tenant_id, code)
);

create table if not exists public.task_dependencies (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_code text not null,
  depends_on text not null,
  primary key (tenant_id, template_code, depends_on)
);

-- Tie tasks table to templates for idempotency
alter table public.tasks add column if not exists template_code text;

-- RLS for templates and dependencies (tenant scoped)
alter table public.task_templates enable row level security;
alter table public.task_dependencies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_templates' and policyname='tenant_can_select_task_templates'
  ) then
    execute 'create policy tenant_can_select_task_templates on public.task_templates for select using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_templates' and policyname='tenant_can_insert_task_templates'
  ) then
    execute 'create policy tenant_can_insert_task_templates on public.task_templates for insert with check (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_templates' and policyname='tenant_can_update_task_templates'
  ) then
    execute 'create policy tenant_can_update_task_templates on public.task_templates for update using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_templates' and policyname='tenant_can_delete_task_templates'
  ) then
    execute 'create policy tenant_can_delete_task_templates on public.task_templates for delete using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_dependencies' and policyname='tenant_can_select_task_dependencies'
  ) then
    execute 'create policy tenant_can_select_task_dependencies on public.task_dependencies for select using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_dependencies' and policyname='tenant_can_insert_task_dependencies'
  ) then
    execute 'create policy tenant_can_insert_task_dependencies on public.task_dependencies for insert with check (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_dependencies' and policyname='tenant_can_update_task_dependencies'
  ) then
    execute 'create policy tenant_can_update_task_dependencies on public.task_dependencies for update using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='task_dependencies' and policyname='tenant_can_delete_task_dependencies'
  ) then
    execute 'create policy tenant_can_delete_task_dependencies on public.task_dependencies for delete using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
end $$;
