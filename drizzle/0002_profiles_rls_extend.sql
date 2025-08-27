-- Extend profiles RLS: allow tenant users to SELECT team directory, and admins to UPDATE member details.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'tenant_can_select_profiles'
  ) then
    execute 'create policy tenant_can_select_profiles on public.profiles for select using (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
    )';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'admin_can_update_profiles'
  ) then
    execute 'create policy admin_can_update_profiles on public.profiles for update using (
      exists (
        select 1 from public.profiles me
        where me.user_id = auth.uid()
          and me.tenant_id = profiles.tenant_id
          and me.role in (''owner'',''admin'')
      )
    ) with check (
      exists (
        select 1 from public.profiles me
        where me.user_id = auth.uid()
          and me.tenant_id = profiles.tenant_id
          and me.role in (''owner'',''admin'')
      )
    )';
  end if;
end $$;

