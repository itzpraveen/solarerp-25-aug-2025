-- Auto-provision tenant + profile for new auth users to avoid "Profile not ready" UX.
-- Idempotent: recreate function and trigger safely.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant uuid;
  v_name text;
begin
  -- If a profile already exists for this user, do nothing
  if exists (select 1 from public.profiles where user_id = new.id) then
    return new;
  end if;

  -- Derive a friendly name from email if available
  v_name := coalesce(new.raw_user_meta_data->>'name', new.email, 'User');

  -- Create a tenant and owner profile for this user
  insert into public.tenants(name) values (coalesce(v_name, 'Company'))
    returning id into v_tenant;

  insert into public.profiles(user_id, tenant_id, role, display_name)
    values (new.id, v_tenant, 'owner', v_name);

  -- Seed default settings for the new tenant if not present
  insert into public.settings(tenant_id, currency, default_tax_rate, deposit_percent)
    values (v_tenant, 'INR', 0, 0)
    on conflict do nothing;

  return new;
end;
$$;

-- Create trigger on auth.users to call the bootstrapper
drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

