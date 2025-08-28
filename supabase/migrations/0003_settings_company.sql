-- Extend settings with company profile fields (idempotent)
alter table public.settings add column if not exists company_phone text;
alter table public.settings add column if not exists company_email text;
alter table public.settings add column if not exists company_address text;
alter table public.settings add column if not exists company_logo_url text;

