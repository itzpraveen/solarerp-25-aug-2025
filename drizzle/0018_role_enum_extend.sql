-- Ensure the role enum contains all app roles used by the UI.
-- Safe, idempotent adds per label.
do $$ begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'role' and e.enumlabel = 'admin'
  ) then
    alter type role add value 'admin';
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'role' and e.enumlabel = 'manager'
  ) then
    alter type role add value 'manager';
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'role' and e.enumlabel = 'sales'
  ) then
    alter type role add value 'sales';
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'role' and e.enumlabel = 'technician'
  ) then
    alter type role add value 'technician';
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'role' and e.enumlabel = 'accountant'
  ) then
    alter type role add value 'accountant';
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'role' and e.enumlabel = 'viewer'
  ) then
    alter type role add value 'viewer';
  end if;
  -- 'staff' already exists in initial enum; keep for backward compatibility.
end $$;

