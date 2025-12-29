-- Fix RLS recursion on profiles by using SECURITY DEFINER helper functions.
-- Creates stable helpers to fetch current tenant id and admin status without RLS recursion.

create or replace function public.app_current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and role::text in ('owner','admin')
  )
$$;

revoke all on function public.app_current_tenant_id() from public;
revoke all on function public.app_is_admin() from public;
grant execute on function public.app_current_tenant_id() to anon, authenticated;
grant execute on function public.app_is_admin() to anon, authenticated;

do $$
begin
  -- Replace tenant_can_select_profiles policy using function to avoid recursion
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'tenant_can_select_profiles'
  ) then
    execute 'drop policy tenant_can_select_profiles on public.profiles';
  end if;
  execute 'create policy tenant_can_select_profiles on public.profiles for select using (
    tenant_id = public.app_current_tenant_id()
  )';

  -- Replace admin_can_update_profiles policy similarly
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'admin_can_update_profiles'
  ) then
    execute 'drop policy admin_can_update_profiles on public.profiles';
  end if;
  execute 'create policy admin_can_update_profiles on public.profiles for update using (
    public.app_is_admin() and tenant_id = public.app_current_tenant_id()
  ) with check (
    public.app_is_admin() and tenant_id = public.app_current_tenant_id()
  )';
end $$;
