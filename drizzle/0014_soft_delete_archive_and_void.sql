-- Add soft-delete and archive columns (idempotent guards)
do $$
begin
  -- customers.deleted_at
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'deleted_at'
  ) then
    alter table public.customers add column deleted_at timestamptz;
  end if;

  -- items.archived
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'archived'
  ) then
    alter table public.items add column archived boolean not null default false;
  end if;

  -- proposals.voided_at
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proposals' and column_name = 'voided_at'
  ) then
    alter table public.proposals add column voided_at timestamptz;
  end if;
end $$;

