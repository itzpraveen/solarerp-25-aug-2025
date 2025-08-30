-- Backfill company_name in settings from tenants.name when missing
-- Safe to run multiple times; only fills NULL/blank values

-- Ensure column exists (idempotent guard)
alter table public.settings add column if not exists company_name text;

-- Populate when empty
update public.settings s
set company_name = t.name
from public.tenants t
where s.tenant_id = t.id
  and (s.company_name is null or btrim(s.company_name) = '');

