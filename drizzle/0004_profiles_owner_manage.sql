-- Allow owners to manage team profiles within their tenant (idempotent)

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='owner_can_select_profiles'
  ) then
    execute $$create policy owner_can_select_profiles on public.profiles for select using (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
      and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = profiles.tenant_id and p.role = 'owner')
    )$$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='owner_can_update_profiles'
  ) then
    execute $$create policy owner_can_update_profiles on public.profiles for update using (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
      and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = profiles.tenant_id and p.role = 'owner')
    ) with check (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
      and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = profiles.tenant_id and p.role = 'owner')
    )$$;
  end if;
end $$;

