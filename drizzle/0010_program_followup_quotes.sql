-- Add program type enum and column on jobs
do $$ begin
  create type program_type as enum ('PM_Surya', 'Commercial');
exception when duplicate_object then null; end $$;

alter table public.jobs
  add column if not exists program_type program_type default 'PM_Surya'::program_type;

-- Lead follow-up fields
alter table public.leads
  add column if not exists next_follow_up_date date,
  add column if not exists last_contacted_at date;

-- Quote numbering settings
alter table public.settings
  add column if not exists quote_prefix text,
  add column if not exists quote_format text;

