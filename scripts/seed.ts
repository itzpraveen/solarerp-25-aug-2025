import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing env SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key);

  // Resolve tenant: if SEED_TENANT_ID provided but missing, create it.
  const TENANT_ID = await (async () => {
    const envId = process.env.SEED_TENANT_ID?.trim();
    if (envId) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', envId)
        .maybeSingle();
      if (!existing?.id) {
        const { error } = await supabase
          .from('tenants')
          .insert({ id: envId, name: 'Demo Tenant' });
        if (error)
          throw new Error(
            `Failed to ensure tenant ${envId}: ${error.message}`,
          );
      }
      return envId as string;
    }
    const { data, error } = await supabase
      .from('tenants')
      .insert({ name: 'Demo Tenant' })
      .select('id')
      .single();
    if (error || !data?.id)
      throw new Error(
        `Failed to create tenant: ${error?.message || 'unknown error'}`,
      );
    return data.id as string;
  })();

  let res = await supabase.from('settings').upsert({
    tenant_id: TENANT_ID,
    currency: 'INR',
    default_tax_rate: 0,
    primary_discom: 'KSEB',
    upi_id: 'demo@upi',
    deposit_percent: 20,
    company_phone: '+91-9999999999',
    company_email: 'sales@example.com',
    company_address: 'Kerala',
    company_logo_url: '',
  });
  if (res.error) console.warn('settings upsert warning:', res.error.message);

  // Kits
  res = await supabase.from('kits').upsert([
    { tenant_id: TENANT_ID, kit_name: 'On-grid 1 kW', capacity_kw: 1, selling_price: 65000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 2 kW', capacity_kw: 2, selling_price: 125000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 3 kW', capacity_kw: 3, selling_price: 185000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 4 kW', capacity_kw: 4, selling_price: 225000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 5 kW', capacity_kw: 5, selling_price: 265000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 6 kW', capacity_kw: 6, selling_price: 315000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 8 kW', capacity_kw: 8, selling_price: 410000 },
    { tenant_id: TENANT_ID, kit_name: 'On-grid 10 kW', capacity_kw: 10, selling_price: 520000 },
    // Hybrid & Off-grid quick templates
    { tenant_id: TENANT_ID, kit_name: 'Hybrid 3 kW', capacity_kw: 3, selling_price: 295000 },
    { tenant_id: TENANT_ID, kit_name: 'Hybrid 5 kW', capacity_kw: 5, selling_price: 525000 },
    { tenant_id: TENANT_ID, kit_name: 'Off-grid 3 kW', capacity_kw: 3, selling_price: 275000 },
    { tenant_id: TENANT_ID, kit_name: 'Off-grid 5 kW', capacity_kw: 5, selling_price: 480000 },
  ]);
  if (res.error) console.warn('kits upsert warning:', res.error.message);

  // Sample customer
  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .insert({
      tenant_id: TENANT_ID,
      name: 'Harilal',
      phone: '+91-9xxxxxxxxx',
      address: 'Mampad PO',
    })
    .select('id')
    .single();
  if (custErr || !cust?.id)
    throw new Error(
      `Failed to insert customer: ${custErr?.message || 'unknown error'}`,
    );

  // Sample job
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .insert({
      tenant_id: TENANT_ID,
      customer_id: cust.id,
      system_type: 'On-grid',
      status: 'Lead',
      capacity_kw: 5,
      location: 'Mampad',
    })
    .select('id')
    .single();
  if (jobErr || !job?.id)
    throw new Error(
      `Failed to insert job: ${jobErr?.message || 'unknown error'}`,
    );

  // Sample proposal (with storage-like key)
  const proposalKey = `${TENANT_ID}/Q${Date.now()}_DEMO.pdf`;
  const { error: propErr } = await supabase
    .from('proposals')
    .insert({
      tenant_id: TENANT_ID,
      job_id: job.id,
      date: new Date().toISOString().slice(0, 10),
      kit_name: 'On-grid 5 kW',
      price_before_tax: 265000,
      tax: 0,
      total: 265000,
      pdf_url: proposalKey,
    });
  if (propErr) console.warn('proposal insert warning:', propErr.message);

  // Optional: upload placeholder PDF so Open PDF works
  const mockPath = path.resolve(process.cwd(), 'uploads', 'mock.pdf');
  if (fs.existsSync(mockPath)) {
    const body = fs.readFileSync(mockPath);
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(proposalKey, body, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (upErr) console.warn('storage upload warning:', upErr.message);
  } else {
    console.warn('uploads/mock.pdf not found; skipping PDF upload');
  }

  // Sample invoice
  const { error: invErr } = await supabase
    .from('invoices')
    .insert({
      tenant_id: TENANT_ID,
      job_id: job.id,
      invoice_type: 'Deposit',
      date: new Date().toISOString().slice(0, 10),
      amount_before_tax: 53000,
      tax: 0,
      total: 53000,
      status: 'Draft',
      due_date: new Date().toISOString().slice(0, 10),
    });
  if (invErr) console.warn('invoice insert warning:', invErr.message);

  console.log('Seeded tenant', TENANT_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
