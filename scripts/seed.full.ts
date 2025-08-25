import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type Id = string;

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const TENANT_ID: Id = process.env.SEED_TENANT_ID || (await (async () => {
    const { data } = await supabase.from('tenants').insert({ name: 'Demo Tenant' }).select('id').single();
    return data!.id as string;
  })());

  // Settings with company profile
  await supabase.from('settings').upsert({
    tenant_id: TENANT_ID,
    currency: 'INR',
    default_tax_rate: 0,
    primary_discom: 'KSEB',
    upi_id: 'demo@upi',
    deposit_percent: 30,
    proposal_note_ml: 'ഇത് ഒരു പ്രാഥമിക ക്വോട്ടേഷനാണ്; സൈറ്റിന്റെ അന്തിമ പരിശോധനയ്ക്ക് ശേഷം ചെറിയ മാറ്റങ്ങൾ വരാം.',
    company_phone: '+91-9999999999',
    company_email: 'sales@demo.solar',
    company_address: 'Kakkanad, Kochi, Kerala',
    company_logo_url: 'https://dummyimage.com/200x80/cccccc/000000&text=Demo+Solar',
  });

  // Items
  const items = [
    { item_code: 'MOD-550', name: 'Bifacial PV Module 550 Wp', unit: 'Nos', gst_rate: 0, mrp: 12500, preferred_vendor: 'Havells' },
    { item_code: 'INV-5K', name: 'On-grid Inverter 5 kW', unit: 'Nos', gst_rate: 0, mrp: 56000, preferred_vendor: 'Havells' },
    { item_code: 'ACDB', name: 'ACDB', unit: 'Set', gst_rate: 0, mrp: 4500, preferred_vendor: 'Havells' },
    { item_code: 'DCDB', name: 'DCDB', unit: 'Set', gst_rate: 0, mrp: 4500, preferred_vendor: 'Havells' },
    { item_code: 'CAB-6', name: 'Solar Cable 6 sqmm', unit: 'RM', gst_rate: 0, mrp: 220, preferred_vendor: 'Polycab' },
    { item_code: 'EARTH', name: 'Earthing & LA', unit: 'Set', gst_rate: 0, mrp: 9000, preferred_vendor: '—' },
    { item_code: 'MMS-GI', name: 'MMS GI Structure', unit: 'Set', gst_rate: 0, mrp: 18000, preferred_vendor: 'Local Fabrication' },
    { item_code: 'CTMTR', name: 'Net Meter (CT)', unit: 'Nos', gst_rate: 0, mrp: 40000, preferred_vendor: 'KSEB' },
  ];
  await supabase.from('items').upsert(items.map(i => ({ ...i, tenant_id: TENANT_ID })));

  // Kits + kit items
  const kits = [
    { kit_name: 'On-grid 1 kW', capacity_kw: 1, selling_price: 65000 },
    { kit_name: 'On-grid 3 kW', capacity_kw: 3, selling_price: 185000 },
    { kit_name: 'On-grid 5 kW', capacity_kw: 5, selling_price: 265000 },
  ];
  await supabase.from('kits').upsert(kits.map(k => ({ ...k, tenant_id: TENANT_ID })));

  const kitItems = [
    { kit_name: 'On-grid 5 kW', item_code: 'MOD-550', qty: 10 },
    { kit_name: 'On-grid 5 kW', item_code: 'INV-5K', qty: 1 },
    { kit_name: 'On-grid 5 kW', item_code: 'ACDB', qty: 1 },
    { kit_name: 'On-grid 5 kW', item_code: 'DCDB', qty: 1 },
    { kit_name: 'On-grid 5 kW', item_code: 'CAB-6', qty: 50 },
    { kit_name: 'On-grid 5 kW', item_code: 'EARTH', qty: 1 },
    { kit_name: 'On-grid 5 kW', item_code: 'MMS-GI', qty: 1 },
  ];
  await supabase.from('kit_items').upsert(kitItems);

  // Customers
  const customers = [
    { name: 'Harilal', phone: '+91-98xxxxxxx', address: 'Mampad PO' },
    { name: 'Anjali', phone: '+91-97xxxxxxx', address: 'Edappally' },
    { name: 'Vivek', phone: '+91-96xxxxxxx', address: 'Kozhikode' },
    { name: 'Meera', phone: '+91-95xxxxxxx', address: 'Thrissur' },
    { name: 'Shan', phone: '+91-94xxxxxxx', address: 'Aluva' },
  ];
  const custIds: Id[] = [];
  for (const c of customers) {
    const { data } = await supabase
      .from('customers')
      .insert({ tenant_id: TENANT_ID, ...c })
      .select('id')
      .single();
    custIds.push(data!.id);
  }

  // Leads
  const leads = [
    { name: 'Joseph', phone: '+91-93xxxxxxx', interested_capacity_kw: 3 },
    { name: 'Bindu', phone: '+91-92xxxxxxx', interested_capacity_kw: 5 },
    { name: 'Ravi', phone: '+91-91xxxxxxx', interested_capacity_kw: 1 },
  ];
  for (const l of leads) {
    await supabase.from('leads').insert({ tenant_id: TENANT_ID, date: new Date().toISOString().slice(0,10), ...l, status: 'New' });
  }

  // Jobs across statuses
  const statuses = ['Lead','Qualified','Quoted','Won','KSEB_Submitted','Material_Ordered','Installed','Net_Metered','Handover'] as const;
  const jobIds: Id[] = [];
  for (let i = 0; i < statuses.length && i < custIds.length; i++) {
    const s = statuses[i];
    const dates: Record<string, string | null> = {
      date_lead: todayOffset(-30 + i * 2),
      date_site_survey: ['Lead','Qualified'].includes(s) ? null : todayOffset(-25 + i * 2),
      date_quote: ['Lead','Qualified'].includes(s) ? null : todayOffset(-23 + i * 2),
      date_won: ['Won','KSEB_Submitted','Material_Ordered','Installed','Net_Metered','Handover'].includes(s) ? todayOffset(-20 + i * 2) : null,
      date_kseb_submit: ['KSEB_Submitted','Material_Ordered','Installed','Net_Metered','Handover'].includes(s) ? todayOffset(-15 + i * 2) : null,
      date_install: ['Installed','Net_Metered','Handover'].includes(s) ? todayOffset(-7 + i * 2) : null,
      date_meter: ['Net_Metered','Handover'].includes(s) ? todayOffset(-3 + i * 2) : null,
      date_handover: s === 'Handover' ? todayOffset(0) : null,
    };
    const { data } = await supabase
      .from('jobs')
      .insert({
        tenant_id: TENANT_ID,
        customer_id: custIds[i],
        system_type: 'On-grid',
        status: s,
        capacity_kw: i < 2 ? 3 : 5,
        location: 'Kerala',
        quoted_price: 200000,
        tax_rate: 0,
        total_amount: 200000,
        ...dates,
      })
      .select('id')
      .single();
    jobIds.push(data!.id);
  }

  // Proposals for first two jobs
  for (let i = 0; i < Math.min(2, jobIds.length); i++) {
    const j = jobIds[i];
    await supabase.from('proposals').insert({
      tenant_id: TENANT_ID,
      job_id: j,
      date: todayOffset(-5 + i),
      kit_name: 'On-grid 5 kW',
      price_before_tax: 265000,
      tax: 0,
      total: 265000,
      pdf_url: `${TENANT_ID}/Q${Date.now()}_${i}.pdf`,
    });
  }

  // Invoices + payments
  if (jobIds[3]) {
    const { data: inv } = await supabase
      .from('invoices')
      .insert({ tenant_id: TENANT_ID, job_id: jobIds[3], invoice_type: 'Deposit', date: todayOffset(-10), amount_before_tax: 60000, tax: 0, total: 60000, status: 'Paid', due_date: todayOffset(-9) })
      .select('id')
      .single();
    await supabase.from('payments').insert({ tenant_id: TENANT_ID, invoice_id: inv!.id, date: todayOffset(-9), mode: 'UPI', amount: 60000, reference: 'UPI-REF-123', received_by: 'Owner' });
  }
  if (jobIds[4]) {
    await supabase.from('invoices').insert({ tenant_id: TENANT_ID, job_id: jobIds[4], invoice_type: 'Final', date: todayOffset(-3), amount_before_tax: 140000, tax: 0, total: 140000, status: 'Sent', due_date: todayOffset(4) });
  }

  // Documents
  if (jobIds[0]) {
    await supabase.from('documents').insert({ tenant_id: TENANT_ID, job_id: jobIds[0], doc_type: 'site_photo', file_url: 'https://dummyimage.com/1200x800/eeeeee/000000&text=Site+Photo' });
  }

  // Tasks
  if (jobIds[1]) {
    await supabase.from('tasks').insert({ tenant_id: TENANT_ID, job_id: jobIds[1], title: 'Call customer for KSEB feasibility', due_date: todayOffset(2), status: 'Open' });
  }

  // Service ticket
  await supabase.from('service_tickets').insert({ tenant_id: TENANT_ID, customer_id: custIds[0], job_id: jobIds[0], date: todayOffset(0), issue_type: 'Low Generation', priority: 'Medium', status: 'Open', summary: 'Check earthing' });

  console.log('Seeded demo data for tenant:', TENANT_ID);
}

function todayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

