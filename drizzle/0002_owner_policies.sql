-- Enforce owner-only writes on items, kits, and settings (idempotent)

-- ITEMS
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='items' and policyname='tenant_can_insert_items'
  ) then
    execute 'drop policy tenant_can_insert_items on public.items';
  end if;
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='items' and policyname='tenant_can_update_items'
  ) then
    execute 'drop policy tenant_can_update_items on public.items';
  end if;
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='items' and policyname='tenant_can_delete_items'
  ) then
    execute 'drop policy tenant_can_delete_items on public.items';
  end if;

  execute $$create policy owner_can_insert_items on public.items for insert
    with check (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
      and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = items.tenant_id and p.role = 'owner')
    )$$;

  execute $$create policy owner_can_update_items on public.items for update using (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
      and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = items.tenant_id and p.role = 'owner')
    )$$;

  execute $$create policy owner_can_delete_items on public.items for delete using (
      tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
      and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = items.tenant_id and p.role = 'owner')
    )$$;
end $$;

-- KITS
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='kits' and policyname='tenant_can_insert_kits') then
    execute 'drop policy tenant_can_insert_kits on public.kits';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='kits' and policyname='tenant_can_update_kits') then
    execute 'drop policy tenant_can_update_kits on public.kits';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='kits' and policyname='tenant_can_delete_kits') then
    execute 'drop policy tenant_can_delete_kits on public.kits';
  end if;

  execute $$create policy owner_can_insert_kits on public.kits for insert with check (
    tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()) and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = kits.tenant_id and p.role = 'owner')
  )$$;
  execute $$create policy owner_can_update_kits on public.kits for update using (
    tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()) and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = kits.tenant_id and p.role = 'owner')
  )$$;
  execute $$create policy owner_can_delete_kits on public.kits for delete using (
    tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()) and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = kits.tenant_id and p.role = 'owner')
  )$$;
end $$;

-- SETTINGS
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='settings' and policyname='tenant_can_insert_settings') then
    execute 'drop policy tenant_can_insert_settings on public.settings';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='settings' and policyname='tenant_can_update_settings') then
    execute 'drop policy tenant_can_update_settings on public.settings';
  end if;

  execute $$create policy owner_can_insert_settings on public.settings for insert with check (
    tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()) and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = settings.tenant_id and p.role = 'owner')
  )$$;
  execute $$create policy owner_can_update_settings on public.settings for update using (
    tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()) and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.tenant_id = settings.tenant_id and p.role = 'owner')
  )$$;
end $$;

