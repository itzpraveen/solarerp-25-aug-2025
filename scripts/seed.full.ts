import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

type Id = string;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing env SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key);

  // Resolve tenant: if SEED_TENANT_ID is provided but missing, create it.
  const TENANT_ID: Id = await (async () => {
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
        if (error) {
          throw new Error(
            `Failed to ensure tenant ${envId}: ${error.message}. Have you applied migrations?`,
          );
        }
      }
      return envId as string;
    }
    const { data, error } = await supabase
      .from('tenants')
      .insert({ name: 'Demo Tenant' })
      .select('id')
      .single();
    if (error || !data?.id) {
      throw new Error(
        `Failed to create tenant: ${error?.message || 'unknown error'}. Have you applied migrations?`,
      );
    }
    return data.id as string;
  })();

  // Settings with company profile
  let res = await supabase.from('settings').upsert({
    tenant_id: TENANT_ID,
    currency: 'INR',
    default_tax_rate: 0,
    primary_discom: 'KSEB',
    upi_id: 'demo@upi',
    deposit_percent: 30,
    proposal_note_ml:
      'ഇത് ഒരു പ്രാഥമിക ക്വോട്ടേഷനാണ്; സൈറ്റിന്റെ അന്തിമ പരിശോധനയ്ക്ക് ശേഷം ചെറിയ മാറ്റങ്ങൾ വരാം.',
    company_phone: '+91-9999999999',
    company_email: 'sales@demo.solar',
    company_address: 'Kakkanad, Kochi, Kerala',
    company_logo_url:
      'https://dummyimage.com/200x80/cccccc/000000&text=Demo+Solar',
  });
  if (res.error) console.warn('settings upsert warning:', res.error.message);

  // Items
  const items = [
    {
      item_code: 'MOD-550',
      name: 'Bifacial PV Module 550 Wp',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 12500,
      preferred_vendor: 'Havells',
    },
    // Hybrid and Off-grid inverters
    {
      item_code: 'INV-HYB-3K',
      name: 'Hybrid Inverter 3 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 85000,
      preferred_vendor: 'Luminous',
    },
    {
      item_code: 'INV-HYB-5K',
      name: 'Hybrid Inverter 5 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 120000,
      preferred_vendor: 'Luminous',
    },
    {
      item_code: 'INV-OFF-3K',
      name: 'Off-grid Inverter 3 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 60000,
      preferred_vendor: 'V-Guard',
    },
    {
      item_code: 'INV-OFF-5K',
      name: 'Off-grid Inverter 5 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 90000,
      preferred_vendor: 'V-Guard',
    },
    // MPPT charge controllers (used in some off-grid configurations)
    {
      item_code: 'MPPT-3K',
      name: 'MPPT Charge Controller 3 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 25000,
      preferred_vendor: 'EPEVER',
    },
    {
      item_code: 'MPPT-5K',
      name: 'MPPT Charge Controller 5 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 38000,
      preferred_vendor: 'EPEVER',
    },
    // Lithium batteries (rack-mount LFP)
    {
      item_code: 'BAT-LFP-5KWH',
      name: 'LFP Battery 5 kWh',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 160000,
      preferred_vendor: 'EXIDE',
    },
    {
      item_code: 'BAT-LFP-10KWH',
      name: 'LFP Battery 10 kWh',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 300000,
      preferred_vendor: 'EXIDE',
    },
    // Inverters (common Kerala residential/commercial sizes)
    {
      item_code: 'INV-1K',
      name: 'On-grid Inverter 1 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 25000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'INV-2K',
      name: 'On-grid Inverter 2 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 35000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'INV-3K',
      name: 'On-grid Inverter 3 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 45000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'INV-4K',
      name: 'On-grid Inverter 4 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 52000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'INV-5K',
      name: 'On-grid Inverter 5 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 56000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'INV-6K',
      name: 'On-grid Inverter 6 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 65000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'INV-8K',
      name: 'On-grid Inverter 8 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 85000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'INV-10K',
      name: 'On-grid Inverter 10 kW',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 110000,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'ACDB',
      name: 'ACDB',
      unit: 'Set',
      gst_rate: 0,
      mrp: 4500,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'DCDB',
      name: 'DCDB',
      unit: 'Set',
      gst_rate: 0,
      mrp: 4500,
      preferred_vendor: 'Havells',
    },
    {
      item_code: 'CAB-6',
      name: 'Solar Cable 6 sqmm',
      unit: 'RM',
      gst_rate: 0,
      mrp: 220,
      preferred_vendor: 'Polycab',
    },
    {
      item_code: 'EARTH',
      name: 'Earthing & LA',
      unit: 'Set',
      gst_rate: 0,
      mrp: 9000,
      preferred_vendor: '—',
    },
    {
      item_code: 'MMS-GI',
      name: 'MMS GI Structure',
      unit: 'Set',
      gst_rate: 0,
      mrp: 18000,
      preferred_vendor: 'Local Fabrication',
    },
    {
      item_code: 'CTMTR',
      name: 'Net Meter (CT)',
      unit: 'Nos',
      gst_rate: 0,
      mrp: 40000,
      preferred_vendor: 'KSEB',
    },
  ];
  res = await supabase
    .from('items')
    .upsert(items.map((i) => ({ ...i, tenant_id: TENANT_ID })));
  if (res.error) console.warn('items upsert warning:', res.error.message);

  // Kits + kit items
  // On-grid kit templates
  const kits = [
    { kit_name: 'On-grid 1 kW', capacity_kw: 1, selling_price: 65000 },
    { kit_name: 'On-grid 2 kW', capacity_kw: 2, selling_price: 125000 },
    { kit_name: 'On-grid 3 kW', capacity_kw: 3, selling_price: 185000 },
    { kit_name: 'On-grid 4 kW', capacity_kw: 4, selling_price: 225000 },
    { kit_name: 'On-grid 5 kW', capacity_kw: 5, selling_price: 265000 },
    { kit_name: 'On-grid 6 kW', capacity_kw: 6, selling_price: 315000 },
    { kit_name: 'On-grid 8 kW', capacity_kw: 8, selling_price: 410000 },
    { kit_name: 'On-grid 10 kW', capacity_kw: 10, selling_price: 520000 },
  ];
  res = await supabase
    .from('kits')
    .upsert(kits.map((k) => ({ ...k, tenant_id: TENANT_ID })));
  if (res.error) console.warn('kits upsert warning:', res.error.message);

  // Build kit_items for each size
  // Heuristics: tweak via env if needed. Defaults are KSEB-friendly.
  const CT_METER_THRESHOLD_KW = Number(process.env.SEED_CT_METER_KW || 8);
  const CABLE_METERS_PER_KW = Number(process.env.SEED_CABLE_M_PER_KW || 10);
  const inverterByKw: Record<number, string> = {
    1: 'INV-1K',
    2: 'INV-2K',
    3: 'INV-3K',
    4: 'INV-4K',
    5: 'INV-5K',
    6: 'INV-6K',
    8: 'INV-8K',
    10: 'INV-10K',
  };
  const kitItems: Array<{ kit_name: string; item_code: string; qty: number }> = [];
  for (const k of kits) {
    const kw = Number(k.capacity_kw);
    const panels = Math.ceil((kw * 1000) / 550);
    const cableLen = Math.round(kw * CABLE_METERS_PER_KW);
    const invCode = inverterByKw[kw as keyof typeof inverterByKw];
    kitItems.push(
      { kit_name: k.kit_name, item_code: 'MOD-550', qty: panels },
      { kit_name: k.kit_name, item_code: invCode, qty: 1 },
      { kit_name: k.kit_name, item_code: 'ACDB', qty: 1 },
      { kit_name: k.kit_name, item_code: 'DCDB', qty: 1 },
      { kit_name: k.kit_name, item_code: 'CAB-6', qty: cableLen },
      { kit_name: k.kit_name, item_code: 'EARTH', qty: 1 },
      { kit_name: k.kit_name, item_code: 'MMS-GI', qty: 1 },
    );
    // CT meter for larger systems (threshold configurable)
    if (kw >= CT_METER_THRESHOLD_KW) {
      kitItems.push({ kit_name: k.kit_name, item_code: 'CTMTR', qty: 1 });
    }
  }
  res = await supabase.from('kit_items').upsert(kitItems);
  if (res.error) console.warn('kit_items upsert warning:', res.error.message);

  // Hybrid kits (with storage; grid-tied)
  const hybridKits = [
    { kit_name: 'Hybrid 3 kW', capacity_kw: 3, selling_price: 295000 },
    { kit_name: 'Hybrid 5 kW', capacity_kw: 5, selling_price: 525000 },
  ];
  res = await supabase
    .from('kits')
    .upsert(hybridKits.map((k) => ({ ...k, tenant_id: TENANT_ID })));
  if (res.error) console.warn('hybrid kits upsert warning:', res.error.message);

  const hybridKitItems: Array<{ kit_name: string; item_code: string; qty: number }> = [];
  for (const k of hybridKits) {
    const kw = Number(k.capacity_kw);
    const panels = Math.ceil((kw * 1000) / 550);
    const cableLen = Math.round(kw * CABLE_METERS_PER_KW);
    const invCode = kw <= 3 ? 'INV-HYB-3K' : 'INV-HYB-5K';
    const batteryUnits = kw <= 3 ? 1 : 2; // 3kW ~5kWh, 5kW ~10kWh
    hybridKitItems.push(
      { kit_name: k.kit_name, item_code: 'MOD-550', qty: panels },
      { kit_name: k.kit_name, item_code: invCode, qty: 1 },
      { kit_name: k.kit_name, item_code: 'BAT-LFP-5KWH', qty: batteryUnits },
      { kit_name: k.kit_name, item_code: 'ACDB', qty: 1 },
      { kit_name: k.kit_name, item_code: 'DCDB', qty: 1 },
      { kit_name: k.kit_name, item_code: 'CAB-6', qty: cableLen },
      { kit_name: k.kit_name, item_code: 'EARTH', qty: 1 },
      { kit_name: k.kit_name, item_code: 'MMS-GI', qty: 1 },
    );
    if (kw >= CT_METER_THRESHOLD_KW) {
      hybridKitItems.push({ kit_name: k.kit_name, item_code: 'CTMTR', qty: 1 });
    }
  }
  res = await supabase.from('kit_items').upsert(hybridKitItems);
  if (res.error) console.warn('hybrid kit_items upsert warning:', res.error.message);

  // Off-grid kits (with storage; islanded)
  const offgridKits = [
    { kit_name: 'Off-grid 3 kW', capacity_kw: 3, selling_price: 275000 },
    { kit_name: 'Off-grid 5 kW', capacity_kw: 5, selling_price: 480000 },
  ];
  res = await supabase
    .from('kits')
    .upsert(offgridKits.map((k) => ({ ...k, tenant_id: TENANT_ID })));
  if (res.error) console.warn('off-grid kits upsert warning:', res.error.message);

  const offgridKitItems: Array<{ kit_name: string; item_code: string; qty: number }> = [];
  for (const k of offgridKits) {
    const kw = Number(k.capacity_kw);
    const panels = Math.ceil((kw * 1000) / 550);
    const cableLen = Math.round(kw * CABLE_METERS_PER_KW);
    const invCode = kw <= 3 ? 'INV-OFF-3K' : 'INV-OFF-5K';
    const mpptCode = kw <= 3 ? 'MPPT-3K' : 'MPPT-5K';
    const batteryUnits = kw <= 3 ? 2 : 2; // 3kW ~10kWh, 5kW ~10kWh base
    offgridKitItems.push(
      { kit_name: k.kit_name, item_code: 'MOD-550', qty: panels },
      { kit_name: k.kit_name, item_code: invCode, qty: 1 },
      { kit_name: k.kit_name, item_code: mpptCode, qty: 1 },
      { kit_name: k.kit_name, item_code: 'BAT-LFP-5KWH', qty: batteryUnits },
      { kit_name: k.kit_name, item_code: 'DCDB', qty: 1 },
      { kit_name: k.kit_name, item_code: 'CAB-6', qty: cableLen },
      { kit_name: k.kit_name, item_code: 'EARTH', qty: 1 },
      { kit_name: k.kit_name, item_code: 'MMS-GI', qty: 1 },
    );
  }
  res = await supabase.from('kit_items').upsert(offgridKitItems);
  if (res.error) console.warn('off-grid kit_items upsert warning:', res.error.message);

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
    const { data, error } = await supabase
      .from('customers')
      .insert({ tenant_id: TENANT_ID, ...c })
      .select('id')
      .single();
    if (error || !data?.id)
      throw new Error(
        `Failed to insert customer ${c.name}: ${error?.message || 'unknown error'}`,
      );
    custIds.push(data.id);
  }

  // Leads
  const leads = [
    { name: 'Joseph', phone: '+91-93xxxxxxx', interested_capacity_kw: 3 },
    { name: 'Bindu', phone: '+91-92xxxxxxx', interested_capacity_kw: 5 },
    { name: 'Ravi', phone: '+91-91xxxxxxx', interested_capacity_kw: 1 },
  ];
  for (const l of leads) {
    await supabase
      .from('leads')
      .insert({
        tenant_id: TENANT_ID,
        date: new Date().toISOString().slice(0, 10),
        ...l,
        status: 'New',
      });
  }

  // Jobs across statuses
  const statuses = [
    'Lead',
    'Qualified',
    'Quoted',
    'Won',
    'KSEB_Submitted',
    'Material_Ordered',
    'Installed',
    'Net_Metered',
    'Handover',
  ] as const;
  const jobIds: Id[] = [];
  for (let i = 0; i < statuses.length && i < custIds.length; i++) {
    const s = statuses[i];
    const dates: Record<string, string | null> = {
      date_lead: todayOffset(-30 + i * 2),
      date_site_survey: ['Lead', 'Qualified'].includes(s)
        ? null
        : todayOffset(-25 + i * 2),
      date_quote: ['Lead', 'Qualified'].includes(s)
        ? null
        : todayOffset(-23 + i * 2),
      date_won: [
        'Won',
        'KSEB_Submitted',
        'Material_Ordered',
        'Installed',
        'Net_Metered',
        'Handover',
      ].includes(s)
        ? todayOffset(-20 + i * 2)
        : null,
      date_kseb_submit: [
        'KSEB_Submitted',
        'Material_Ordered',
        'Installed',
        'Net_Metered',
        'Handover',
      ].includes(s)
        ? todayOffset(-15 + i * 2)
        : null,
      date_install: ['Installed', 'Net_Metered', 'Handover'].includes(s)
        ? todayOffset(-7 + i * 2)
        : null,
      date_meter: ['Net_Metered', 'Handover'].includes(s)
        ? todayOffset(-3 + i * 2)
        : null,
      date_handover: s === 'Handover' ? todayOffset(0) : null,
    };
    const { data, error } = await supabase
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
    if (error || !data?.id)
      throw new Error(
        `Failed to insert job for status ${s}: ${error?.message || 'unknown error'}`,
      );
    jobIds.push(data.id);
  }

  // Proposals for first two jobs
  const createdProposalKeys: string[] = [];
  for (let i = 0; i < Math.min(2, jobIds.length); i++) {
    const j = jobIds[i];
    const key = `${TENANT_ID}/Q${Date.now()}_${i}.pdf`;
    const { error } = await supabase.from('proposals').insert({
      tenant_id: TENANT_ID,
      job_id: j,
      date: todayOffset(-5 + i),
      kit_name: 'On-grid 5 kW',
      price_before_tax: 265000,
      tax: 0,
      total: 265000,
      pdf_url: key,
    });
    if (error) console.warn('proposal insert warning:', error.message);
    else createdProposalKeys.push(key);
  }

  // Invoices + payments
  if (jobIds[3]) {
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .insert({
        tenant_id: TENANT_ID,
        job_id: jobIds[3],
        invoice_type: 'Deposit',
        date: todayOffset(-10),
        amount_before_tax: 60000,
        tax: 0,
        total: 60000,
        status: 'Paid',
        due_date: todayOffset(-9),
      })
      .select('id')
      .single();
    if (invErr || !inv?.id) {
      console.warn(
        'invoice insert warning for jobIds[3]:',
        invErr?.message || 'unknown error',
      );
    } else {
      const { error: payErr } = await supabase
        .from('payments')
        .insert({
          tenant_id: TENANT_ID,
          invoice_id: inv.id,
          date: todayOffset(-9),
          mode: 'UPI',
          amount: 60000,
          reference: 'UPI-REF-123',
          received_by: 'Owner',
        });
      if (payErr) console.warn('payment insert warning:', payErr.message);
    }
  }
  if (jobIds[4]) {
    const { error: inv2Err } = await supabase
      .from('invoices')
      .insert({
        tenant_id: TENANT_ID,
        job_id: jobIds[4],
        invoice_type: 'Final',
        date: todayOffset(-3),
        amount_before_tax: 140000,
        tax: 0,
        total: 140000,
        status: 'Sent',
        due_date: todayOffset(4),
      });
    if (inv2Err)
      console.warn('invoice insert warning for jobIds[4]:', inv2Err.message);
  }

  // Documents
  if (jobIds[0]) {
    const { error: docErr } = await supabase
      .from('documents')
      .insert({
        tenant_id: TENANT_ID,
        job_id: jobIds[0],
        doc_type: 'site_photo',
        file_url:
          'https://dummyimage.com/1200x800/eeeeee/000000&text=Site+Photo',
      });
    if (docErr) console.warn('document insert warning:', docErr.message);
  }

  // Tasks
  if (jobIds[1]) {
    const { error: taskErr } = await supabase
      .from('tasks')
      .insert({
        tenant_id: TENANT_ID,
        job_id: jobIds[1],
        title: 'Call customer for KSEB feasibility',
        due_date: todayOffset(2),
        status: 'Open',
      });
    if (taskErr) console.warn('task insert warning:', taskErr.message);
  }

  // Service ticket
  {
    const { error: svcErr } = await supabase
      .from('service_tickets')
      .insert({
        tenant_id: TENANT_ID,
        customer_id: custIds[0],
        job_id: jobIds[0],
        date: todayOffset(0),
        issue_type: 'Low Generation',
        priority: 'Medium',
        status: 'Open',
        summary: 'Check earthing',
      });
    if (svcErr) console.warn('service_tickets insert warning:', svcErr.message);
  }

  // Upload placeholder PDFs for created proposals (optional but helpful for demos)
  const mockPath = path.resolve(process.cwd(), 'uploads', 'mock.pdf');
  if (createdProposalKeys.length) {
    if (!fs.existsSync(mockPath)) {
      console.warn('uploads/mock.pdf not found; skipping PDF uploads.');
    } else {
      const body = fs.readFileSync(mockPath);
      for (const key of createdProposalKeys) {
        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(key, body, {
            contentType: 'application/pdf',
            upsert: true,
          });
        if (upErr)
          console.warn(`storage upload warning for ${key}:`, upErr.message);
      }
    }
  }

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
