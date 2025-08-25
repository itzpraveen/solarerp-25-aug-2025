import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const TENANT_ID = process.env.SEED_TENANT_ID || (await (async () => {
    const { data } = await supabase.from('tenants').insert({ name: 'Demo Tenant' }).select('id').single();
    return data!.id as string;
  })());

  await supabase.from('settings').upsert({
    tenant_id: TENANT_ID,
    currency: 'INR',
    default_tax_rate: 0,
    primary_discom: 'KSEB',
    upi_id: 'demo@upi',
    deposit_percent: 20,
    company_phone: '+91-9999999999',
    company_email: 'sales@example.com',
    company_address: 'Kerala',
    company_logo_url: ''
  });

  // Kits
  await supabase.from('kits').upsert([
    { tenant_id: TENANT_ID, kit_name: 'On-grid 1 kW', capacity_kw: 1, selling_price: 65000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 3 kW', capacity_kw: 3, selling_price: 185000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 5 kW', capacity_kw: 5, selling_price: 265000 },
  ]);

  // Sample customer
  const { data: cust } = await supabase.from('customers').insert({ tenant_id: TENANT_ID, name: 'Harilal', phone: '+91-9xxxxxxxxx', address: 'Mampad PO' }).select('id').single();

  // Sample job
  const { data: job } = await supabase.from('jobs').insert({ tenant_id: TENANT_ID, customer_id: cust!.id, system_type: 'On-grid', status: 'Lead', capacity_kw: 5, location: 'Mampad' }).select('id').single();

  // Sample proposal
  await supabase.from('proposals').insert({ tenant_id: TENANT_ID, job_id: job!.id, date: new Date().toISOString().slice(0,10), kit_name: 'On-grid 5 kW', price_before_tax: 265000, tax: 0, total: 265000 });

  // Sample invoice
  await supabase.from('invoices').insert({ tenant_id: TENANT_ID, job_id: job!.id, invoice_type: 'Deposit', date: new Date().toISOString().slice(0,10), amount_before_tax: 53000, tax: 0, total: 53000, status: 'Draft', due_date: new Date().toISOString().slice(0,10) });

  console.log('Seeded tenant', TENANT_ID);
}

main();
