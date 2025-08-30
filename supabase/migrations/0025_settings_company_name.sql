-- Add company_name to settings for display on PDFs and UPI, optional
alter table public.settings add column if not exists company_name text;

