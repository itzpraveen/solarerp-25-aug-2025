-- Expand role enum and relax owner-only policies to include admin

-- Add new enum values if missing. Note: depending on migration runner,
-- ALTER TYPE may need to run outside a transaction. If drizzle runner wraps
-- in a transaction and fails, run these statements via Supabase SQL editor.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE role ADD VALUE 'admin';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'role' AND e.enumlabel = 'manager'
  ) THEN
    ALTER TYPE role ADD VALUE 'manager';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'role' AND e.enumlabel = 'sales'
  ) THEN
    ALTER TYPE role ADD VALUE 'sales';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'role' AND e.enumlabel = 'technician'
  ) THEN
    ALTER TYPE role ADD VALUE 'technician';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'role' AND e.enumlabel = 'accountant'
  ) THEN
    ALTER TYPE role ADD VALUE 'accountant';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'role' AND e.enumlabel = 'viewer'
  ) THEN
    ALTER TYPE role ADD VALUE 'viewer';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Broaden the helper to treat owner or admin as administrators
create or replace function public.is_owner_of_tenant(target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = target_tenant
      and p.role in ('owner','admin')
  );
$$;

-- Recreate owner-only policies on items, kits and settings to include admin
-- ITEMS
drop policy if exists owner_can_insert_items on public.items;
drop policy if exists owner_can_update_items on public.items;
drop policy if exists owner_can_delete_items on public.items;

create policy owner_can_insert_items on public.items for insert
  with check (
    tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.tenant_id = items.tenant_id and p.role in ('owner','admin')
    )
  );

create policy owner_can_update_items on public.items for update using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = items.tenant_id and p.role in ('owner','admin')
  )
);

create policy owner_can_delete_items on public.items for delete using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = items.tenant_id and p.role in ('owner','admin')
  )
);

-- KITS
drop policy if exists owner_can_insert_kits on public.kits;
drop policy if exists owner_can_update_kits on public.kits;
drop policy if exists owner_can_delete_kits on public.kits;

create policy owner_can_insert_kits on public.kits for insert with check (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = kits.tenant_id and p.role in ('owner','admin')
  )
);
create policy owner_can_update_kits on public.kits for update using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = kits.tenant_id and p.role in ('owner','admin')
  )
);
create policy owner_can_delete_kits on public.kits for delete using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = kits.tenant_id and p.role in ('owner','admin')
  )
);

-- SETTINGS
drop policy if exists owner_can_insert_settings on public.settings;
drop policy if exists owner_can_update_settings on public.settings;
drop policy if exists owner_can_delete_settings on public.settings;

create policy owner_can_insert_settings on public.settings for insert with check (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = settings.tenant_id and p.role in ('owner','admin')
  )
);
create policy owner_can_update_settings on public.settings for update using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = settings.tenant_id and p.role in ('owner','admin')
  )
);
create policy owner_can_delete_settings on public.settings for delete using (
  tenant_id = (select tenant_id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.tenant_id = settings.tenant_id and p.role in ('owner','admin')
  )
);

