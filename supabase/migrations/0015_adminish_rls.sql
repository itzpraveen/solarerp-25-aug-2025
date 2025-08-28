-- Broaden owner-only policies to allow Admin as well (adminish).
-- Replaces owner_can_* policies on items, kits, and settings with admin_can_* using
-- public.app_current_tenant_id() and public.app_is_admin() helpers (SECURITY DEFINER).

do $$
begin
  -- ITEMS
  execute 'drop policy if exists owner_can_insert_items on public.items';
  execute 'drop policy if exists owner_can_update_items on public.items';
  execute 'drop policy if exists owner_can_delete_items on public.items';
  execute 'drop policy if exists admin_can_insert_items on public.items';
  execute 'drop policy if exists admin_can_update_items on public.items';
  execute 'drop policy if exists admin_can_delete_items on public.items';

  execute 'create policy admin_can_insert_items on public.items for insert with check (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';
  execute 'create policy admin_can_update_items on public.items for update using (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';
  execute 'create policy admin_can_delete_items on public.items for delete using (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';

  -- KITS
  execute 'drop policy if exists owner_can_insert_kits on public.kits';
  execute 'drop policy if exists owner_can_update_kits on public.kits';
  execute 'drop policy if exists owner_can_delete_kits on public.kits';
  execute 'drop policy if exists admin_can_insert_kits on public.kits';
  execute 'drop policy if exists admin_can_update_kits on public.kits';
  execute 'drop policy if exists admin_can_delete_kits on public.kits';

  execute 'create policy admin_can_insert_kits on public.kits for insert with check (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';
  execute 'create policy admin_can_update_kits on public.kits for update using (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';
  execute 'create policy admin_can_delete_kits on public.kits for delete using (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';

  -- SETTINGS
  execute 'drop policy if exists owner_can_insert_settings on public.settings';
  execute 'drop policy if exists owner_can_update_settings on public.settings';
  execute 'drop policy if exists owner_can_delete_settings on public.settings';
  execute 'drop policy if exists admin_can_insert_settings on public.settings';
  execute 'drop policy if exists admin_can_update_settings on public.settings';
  execute 'drop policy if exists admin_can_delete_settings on public.settings';

  execute 'create policy admin_can_insert_settings on public.settings for insert with check (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';
  execute 'create policy admin_can_update_settings on public.settings for update using (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';
  execute 'create policy admin_can_delete_settings on public.settings for delete using (
    tenant_id = public.app_current_tenant_id() and public.app_is_admin()
  )';
end $$;

