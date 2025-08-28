-- Add language column to proposals for EN/ML PDFs
alter table if exists public.proposals
  add column if not exists lang text default 'en';

