-- Persist optional cover/notes/work schedule on proposals
alter table if exists public.proposals
  add column if not exists cover jsonb,
  add column if not exists notes jsonb,
  add column if not exists work_schedule jsonb;

