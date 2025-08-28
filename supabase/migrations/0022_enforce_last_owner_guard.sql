-- Prevent removing the last owner of a tenant.
create or replace function public.enforce_at_least_one_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_remaining integer;
begin
  if TG_OP = 'DELETE' then
    v_tenant := old.tenant_id;
    if old.role = 'owner' then
      select count(*) into v_remaining from public.profiles
      where tenant_id = v_tenant and user_id <> old.user_id and role = 'owner';
      if coalesce(v_remaining,0) = 0 then
        raise exception 'Cannot remove the last owner from tenant %', v_tenant;
      end if;
    end if;
    return old;
  elsif TG_OP = 'UPDATE' then
    v_tenant := new.tenant_id;
    if old.role = 'owner' and new.role <> 'owner' then
      select count(*) into v_remaining from public.profiles
      where tenant_id = v_tenant and user_id <> old.user_id and role = 'owner';
      if coalesce(v_remaining,0) = 0 then
        raise exception 'Tenant % must retain at least one owner', v_tenant;
      end if;
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_last_owner on public.profiles;
create trigger trg_enforce_last_owner
before update or delete on public.profiles
for each row execute function public.enforce_at_least_one_owner();

