-- Improve customers search performance using trigram indexes.
-- Safe to run multiple times due to IF NOT EXISTS guards.

-- Enable pg_trgm extension if not already present
create extension if not exists pg_trgm;

-- Trigram GIN indexes for ILIKE contains search on name/phone/email
create index if not exists idx_customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_phone_trgm on public.customers using gin (phone gin_trgm_ops);
create index if not exists idx_customers_email_trgm on public.customers using gin (email gin_trgm_ops);

