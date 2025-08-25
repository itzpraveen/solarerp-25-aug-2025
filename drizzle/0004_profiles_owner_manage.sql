-- Use simple drop-if-exists + create to avoid DO/EXECUTE quoting issues on Supabase
drop policy if exists owner_can_select_profiles on public.profiles;
drop policy if exists owner_can_update_profiles on public.profiles;

create policy owner_can_select_profiles on public.profiles
for select
using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = profiles.tenant_id
      and p.role = 'owner'
  )
);

create policy owner_can_update_profiles on public.profiles
for update
using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = profiles.tenant_id
      and p.role = 'owner'
  )
)
with check (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = profiles.tenant_id
      and p.role = 'owner'
  )
);
