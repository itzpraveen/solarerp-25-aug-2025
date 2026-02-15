-- Formalize company profile fields already used in the UI
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_phone text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_email text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_logo_url text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS quote_prefix text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS quote_format text;

-- Tax & Compliance (required for legal invoicing in India)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS pan_number text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS state_code text DEFAULT '32';

-- Bank details (required for invoice payment info)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_account_no text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_ifsc text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_branch text;

-- Invoice numbering
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS next_invoice_number integer DEFAULT 1;

-- Invoice number on invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text;
