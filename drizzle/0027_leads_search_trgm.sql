-- Improve leads search performance using pg_trgm GIN indexes
create extension if not exists pg_trgm;
create index if not exists idx_leads_name_trgm on public.leads using gin (name gin_trgm_ops);
create index if not exists idx_leads_phone_trgm on public.leads using gin (phone gin_trgm_ops);
create index if not exists idx_leads_email_trgm on public.leads using gin (email gin_trgm_ops);
create index if not exists idx_leads_address_trgm on public.leads using gin (address gin_trgm_ops);
create index if not exists idx_leads_source_trgm on public.leads using gin (source gin_trgm_ops);
create index if not exists idx_leads_notes_trgm on public.leads using gin (notes gin_trgm_ops);

