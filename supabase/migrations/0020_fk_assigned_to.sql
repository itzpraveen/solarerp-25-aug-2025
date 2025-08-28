-- Add a foreign key for leads.assigned_to to profiles(user_id), nullable.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'leads' and constraint_name = 'leads_assigned_to_fkey'
  ) then
    alter table public.leads
      add constraint leads_assigned_to_fkey
      foreign key (assigned_to)
      references public.profiles(user_id)
      on delete set null;
  end if;
end $$;

