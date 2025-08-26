import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { env } from '@/lib/env';
import { enqueueJob, processDueJobs } from '@/lib/queue';
import { secureEqual } from '@/lib/secureCompare';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get('token') || '';
  const secret = process.env.CRON_SECRET || '';
  const allowVercelHeader = process.env.CRON_ALLOW_VERCEL_HEADER === '1';
  const hasVercelCronHeader = req.headers.has('x-vercel-cron');

  const bearerOk = !!secret && secureEqual(bearer, secret);
  const queryOk = !!secret && secureEqual(tokenParam, secret);
  const vercelOk = allowVercelHeader && hasVercelCronHeader;
  return bearerOk || queryOk || vercelOk;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1) Mark overdue invoices
  const today = dayjs().format('YYYY-MM-DD');
  await supabase
    .from('invoices')
    .update({ status: 'Overdue' })
    .lt('due_date', today)
    .neq('status', 'Paid');

  // 2) Enqueue reminders (if enabled via settings - simplified: if default_tax_rate is not null)
  const { data: tenants } = await supabase.from('tenants').select('id');
  for (const t of tenants || []) {
    // Example: enqueue a WhatsApp reminder job for overdue invoices per tenant (payload simplified)
    await enqueueJob(t.id, 'whatsapp_template', {
      to: '91xxxxxxxxxx',
      templateName: 'invoice_due',
      variables: ['Customer', 'INV001', '1000', today, 'https://example.com']
    });
  }

  // 3) Create follow-up tasks N days after date_kseb_submit if status unchanged (configurable)
  const offsets = (env.ksebFollowupDaysCsv || '7,14')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const offsetMap = new Map<number, string>(
    offsets.map((n) => [n, dayjs().subtract(n, 'day').format('YYYY-MM-DD')])
  );
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, tenant_id, date_kseb_submit, status')
    .in('status', ['KSEB_Submitted']);
  for (const j of jobs || []) {
    for (const n of offsets) {
      if (j.date_kseb_submit === offsetMap.get(n)) {
        await enqueueJob(j.tenant_id, 'create_followup_task', {
          tenant_id: j.tenant_id,
          job_id: j.id,
          title: `Follow-up KSEB (${n} days) `,
          due_date: dayjs().format('YYYY-MM-DD'),
        });
      }
    }
  }

  // 3b) Lead follow-up reminders: enqueue WhatsApp template when next_follow_up_date is due
  const { data: leads } = await supabase
    .from('leads')
    .select('tenant_id, id, name, phone, next_follow_up_date, status')
    .not('status', 'in', ['Converted', 'Closed'])
    .lte('next_follow_up_date', today);
  for (const l of leads || []) {
    if (!l.phone) continue;
    await enqueueJob(l.tenant_id, 'whatsapp_template', {
      to: l.phone,
      templateName: 'lead_followup',
      variables: [l.name || 'Customer'],
    });
  }

  try {
    // 4) Process due jobs
    await processDueJobs();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/cron/daily', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}

// Support GET so Vercel Cron (default GET) can also trigger it
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1) Mark overdue invoices
  const today = dayjs().format('YYYY-MM-DD');
  await supabase
    .from('invoices')
    .update({ status: 'Overdue' })
    .lt('due_date', today)
    .neq('status', 'Paid');

  // 2) Enqueue reminders (if enabled via settings - simplified: if default_tax_rate is not null)
  const { data: tenants } = await supabase.from('tenants').select('id');
  for (const t of tenants || []) {
    // Example: enqueue a WhatsApp reminder job for overdue invoices per tenant (payload simplified)
    await enqueueJob(t.id, 'whatsapp_template', {
      to: '91xxxxxxxxxx',
      templateName: 'invoice_due',
      variables: ['Customer', 'INV001', '1000', today, 'https://example.com']
    });
  }

  try {
    // 4) Process due jobs
    await processDueJobs();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/cron/daily', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
