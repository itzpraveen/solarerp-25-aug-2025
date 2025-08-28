-- Extensions
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type system_type as enum ('On-grid', 'Hybrid', 'Off-grid', 'Inverter & Battery', 'Solar Water Heater');
exception when duplicate_object then null; end $$;
do $$ begin
  create type job_status as enum ('Lead', 'Qualified', 'Quoted', 'Won', 'KSEB_Submitted', 'Material_Ordered', 'Installed', 'Net_Metered', 'Handover', 'Closed', 'Lost');
exception when duplicate_object then null; end $$;
do $$ begin
  create type invoice_type as enum ('Deposit', 'Progress', 'Final');
exception when duplicate_object then null; end $$;
do $$ begin
  create type invoice_status as enum ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pay_mode as enum ('UPI', 'NEFT', 'Cash', 'Card', 'Cheque');
exception when duplicate_object then null; end $$;
do $$ begin
  create type task_status as enum ('Open', 'InProgress', 'Blocked', 'Done');
exception when duplicate_object then null; end $$;
do $$ begin
  create type priority as enum ('Low', 'Medium', 'High', 'Urgent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type role as enum ('owner', 'staff');
exception when duplicate_object then null; end $$;

-- Tables
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  user_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role role default 'staff',
  phone text,
  display_name text,
  created_at timestamptz default now(),
  constraint fk_profiles_auth foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  discom text default 'KSEB',
  consumer_no text,
  phase text,
  sanctioned_load_kw numeric(6,2),
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date,
  source text,
  name text,
  phone text,
  email text,
  address text,
  interested_capacity_kw numeric(6,2),
  notes text,
  assigned_to uuid,
  status text
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  system_type system_type not null,
  capacity_kw numeric(6,2),
  roof_type text,
  status job_status not null default 'Lead',
  quoted_price numeric(12,2),
  discount numeric(12,2),
  tax_rate numeric(5,2),
  total_amount numeric(12,2),
  deposit_amount numeric(12,2),
  balance_due numeric(12,2),
  date_lead date,
  date_site_survey date,
  date_quote date,
  date_won date,
  date_kseb_submit date,
  date_install date,
  date_meter date,
  date_handover date,
  kseb_application_no text,
  subsidy_portal_ref text,
  location text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  date date,
  kit_name text,
  price_before_tax numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2),
  valid_till date,
  pdf_url text,
  terms text
);

create table if not exists public.items (
  item_code text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category text,
  unit text,
  gst_rate numeric(5,2),
  mrp numeric(12,2),
  preferred_vendor text,
  specs jsonb
);

create table if not exists public.kits (
  kit_name text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  description text,
  capacity_kw numeric(6,2),
  selling_price numeric(12,2)
);

create table if not exists public.kit_items (
  kit_name text not null references public.kits(kit_name) on delete cascade,
  item_code text not null references public.items(item_code) on delete cascade,
  qty numeric(10,2),
  primary key (kit_name, item_code)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  date date,
  invoice_type invoice_type not null,
  amount_before_tax numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2),
  due_date date,
  status invoice_status default 'Draft',
  irn text,
  pdf_url text
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  date date,
  mode pay_mode,
  amount numeric(12,2),
  reference text,
  received_by text,
  notes text
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  doc_type text,
  file_url text,
  version int,
  signed_by text,
  signed_date date,
  notes text
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text,
  assigned_to uuid,
  due_date date,
  status task_status default 'Open',
  priority priority default 'Medium',
  notes text
);

create table if not exists public.service_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  date date,
  issue_type text,
  priority priority default 'Medium',
  status task_status default 'Open',
  summary text,
  assigned_to uuid,
  resolution_notes text
);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null,
  payload jsonb,
  run_at timestamptz default now(),
  attempts int default 0,
  last_error text
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  currency text default 'INR',
  upi_id text,
  default_tax_rate numeric(5,2) default 0,
  primary_discom text default 'KSEB',
  proposal_note_ml text,
  deposit_percent numeric(5,2) default 0
);

-- RLS
alter table public.profiles enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'user_select_own_profile'
  ) then
    execute 'create policy user_select_own_profile on public.profiles for select using (user_id = auth.uid())';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'user_update_own_profile'
  ) then
    execute 'create policy user_update_own_profile on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end $$;

-- Helper to create tenant-can policies
do $$
declare
  t text;
  pname text;
begin
  -- Tables must have a tenant_id column; exclude kit_items (no tenant_id)
  foreach t in array array['customers','leads','jobs','proposals','items','kits','invoices','payments','documents','tasks','service_tickets','background_jobs','settings'] loop
    execute format('alter table public.%I enable row level security;', t);

    -- SELECT policy
    pname := format('tenant_can_select_%s', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pname
    ) then
      execute format(
        'create policy %I on public.%I for select using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))',
        pname, t
      );
    end if;

    -- INSERT policy
    pname := format('tenant_can_insert_%s', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pname
    ) then
      execute format(
        'create policy %I on public.%I for insert with check (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))',
        pname, t
      );
    end if;

    -- UPDATE policy
    pname := format('tenant_can_update_%s', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pname
    ) then
      execute format(
        'create policy %I on public.%I for update using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))',
        pname, t
      );
    end if;

    -- DELETE policy
    pname := format('tenant_can_delete_%s', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pname
    ) then
      execute format(
        'create policy %I on public.%I for delete using (tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()))',
        pname, t
      );
    end if;
  end loop;
end $$;

alter table public.tenants enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'tenants' and policyname = 'tenant_can_select_tenants'
  ) then
    execute 'create policy tenant_can_select_tenants on public.tenants for select using (id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'tenants' and policyname = 'tenant_can_update_tenants'
  ) then
    execute 'create policy tenant_can_update_tenants on public.tenants for update using (id = (select tenant_id from public.profiles where user_id = auth.uid())) with check (id = (select tenant_id from public.profiles where user_id = auth.uid()))';
  end if;
end $$;

-- Storage bucket and policies
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS policies (idempotent via DROP IF EXISTS)
drop policy if exists tenant_read_own_documents on storage.objects;
create policy tenant_read_own_documents on storage.objects for select
  using (bucket_id = 'documents' and name like ((select tenant_id::text from public.profiles where user_id = auth.uid()) || '/%'));

drop policy if exists tenant_write_own_documents on storage.objects;
create policy tenant_write_own_documents on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and name like ((select tenant_id::text from public.profiles where user_id = auth.uid()) || '/%'));

drop policy if exists tenant_update_own_documents on storage.objects;
create policy tenant_update_own_documents on storage.objects for update
  using (bucket_id = 'documents' and name like ((select tenant_id::text from public.profiles where user_id = auth.uid()) || '/%'));

drop policy if exists tenant_delete_own_documents on storage.objects;
create policy tenant_delete_own_documents on storage.objects for delete
  using (bucket_id = 'documents' and name like ((select tenant_id::text from public.profiles where user_id = auth.uid()) || '/%'));
