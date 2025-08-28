-- Modify bootstrap to only auto-provision for the first-ever user/tenant.
-- Prevents accidental tenant sprawl when normal team members sign in with Gmail.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant uuid;
  v_name text;
  v_has_any boolean;
begin
  -- If a profile already exists for this user, do nothing
  if exists (select 1 from public.profiles where user_id = new.id) then
    return new;
  end if;

  -- Only bootstrap when there are no tenants yet (first user wins)
  select exists(select 1 from public.tenants) into v_has_any;
  if v_has_any then
    -- Do not auto-create a tenant; wait for admin invite to assign profile
    return new;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'name', new.email, 'Owner');
  insert into public.tenants(name) values (coalesce(v_name, 'Company'))
    returning id into v_tenant;
  insert into public.profiles(user_id, tenant_id, role, display_name)
    values (new.id, v_tenant, 'owner', v_name);
  insert into public.settings(tenant_id, currency, default_tax_rate, deposit_percent)
    values (v_tenant, 'INR', 0, 0)
    on conflict do nothing;
  return new;
end;
$$;

