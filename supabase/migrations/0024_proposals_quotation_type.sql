-- Add quotation_type to proposals to distinguish Provisional vs Final
alter table public.proposals
  add column if not exists quotation_type text default 'Final';

