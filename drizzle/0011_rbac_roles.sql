-- Expand role enum with additional values.
-- IMPORTANT: Do not reference new enum labels in the same transaction they
-- are added, or Postgres will raise 55P04 (unsafe use of new enum value).
-- This file only adds enum values. Function/policy changes moved to 0012.

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
