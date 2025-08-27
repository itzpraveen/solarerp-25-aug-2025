import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log('> Scanning jobs in Lead stage without linked lead...');
  const { data: jobs, error: jErr } = await sb
    .from('jobs')
    .select('id, tenant_id, customer_id, branch_id, date_lead, created_at, lead_id')
    .eq('status', 'Lead')
    .is('lead_id', null)
    .limit(1000);
  if (jErr) throw jErr;
  const rows = (jobs || []) as any[];
  console.log(`  Found ${rows.length} job(s) to backfill`);

  let created = 0;
  let linked = 0;
  for (const j of rows) {
    try {
      // Fetch customer details
      const { data: cust, error: cErr } = await sb
        .from('customers')
        .select('name, phone, address')
        .eq('id', j.customer_id)
        .maybeSingle();
      if (cErr) throw cErr;

      // Try reuse existing lead by phone within tenant
      let leadId: string | null = null;
      if (cust?.phone) {
        const { data: existing } = await sb
          .from('leads')
          .select('id, status')
          .eq('tenant_id', j.tenant_id)
          .eq('phone', cust.phone)
          .order('date', { ascending: false })
          .limit(1);
        const reuse = Array.isArray(existing) ? existing[0] : null;
        if (reuse?.id) {
          leadId = reuse.id as string;
          if (reuse.status !== 'Converted') {
            await sb.from('leads').update({ status: 'Converted' }).eq('id', leadId);
          }
        }
      }

      if (!leadId) {
        const date = (j as any).date_lead || (j as any).created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        const { data: lead, error: lErr } = await sb
          .from('leads')
          .insert({
            tenant_id: j.tenant_id,
            date,
            name: (cust as any)?.name || 'Lead',
            phone: (cust as any)?.phone || null,
            address: (cust as any)?.address || null,
            interested_capacity_kw: null,
            status: 'Converted',
            branch_id: j.branch_id || null,
            source: 'Job',
          })
          .select('id')
          .single();
        if (lErr) throw lErr;
        leadId = (lead as any).id;
        created++;
      }

      const { error: uErr } = await sb
        .from('jobs')
        .update({ lead_id: leadId })
        .eq('id', j.id);
      if (uErr) throw uErr;
      linked++;
      console.log(`  Linked job ${j.id} -> lead ${leadId}`);
    } catch (e: any) {
      console.error('  Failed for job', j.id, e?.message || e);
    }
  }

  console.log(`Done. Created leads: ${created}, linked jobs: ${linked}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

