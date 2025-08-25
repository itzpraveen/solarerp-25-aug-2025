import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { enqueueJob, processDueJobs } from '@/lib/queue';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
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

  // 3) Create follow-up tasks 7/14 days after date_kseb_submit if status unchanged
  const seven = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
  const fourteen = dayjs().subtract(14, 'day').format('YYYY-MM-DD');
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, tenant_id, date_kseb_submit, status')
    .in('status', ['KSEB_Submitted']);
  for (const j of jobs || []) {
    if (j.date_kseb_submit === seven) {
      await enqueueJob(j.tenant_id, 'create_followup_task', {
        tenant_id: j.tenant_id,
        job_id: j.id,
        title: 'Follow-up KSEB (7 days) ',
        due_date: dayjs().format('YYYY-MM-DD'),
      });
    }
    if (j.date_kseb_submit === fourteen) {
      await enqueueJob(j.tenant_id, 'create_followup_task', {
        tenant_id: j.tenant_id,
        job_id: j.id,
        title: 'Follow-up KSEB (14 days) ',
        due_date: dayjs().format('YYYY-MM-DD'),
      });
    }
  }

  // 4) Process due jobs
  await processDueJobs();

  return NextResponse.json({ ok: true });
}
