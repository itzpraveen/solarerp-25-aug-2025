-- Create helper function to check owner role without triggering RLS recursion
create or replace function public.is_owner_of_tenant(target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = target_tenant
      and p.role = 'owner'
  );
$$;

revoke all on function public.is_owner_of_tenant(uuid) from public;
grant execute on function public.is_owner_of_tenant(uuid) to authenticated;

-- Recreate profiles policies to use the function (avoids self-referential recursion)
drop policy if exists owner_can_select_profiles on public.profiles;
drop policy if exists owner_can_update_profiles on public.profiles;

create policy owner_can_select_profiles on public.profiles
for select using (
  public.is_owner_of_tenant(tenant_id)
);

create policy owner_can_update_profiles on public.profiles
for update using (
  public.is_owner_of_tenant(tenant_id)
) with check (
  public.is_owner_of_tenant(tenant_id)
);

