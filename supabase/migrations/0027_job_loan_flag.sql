-- Add loan scheme flag to jobs for conditional task templates
alter table public.jobs add column if not exists is_loan boolean default false;

