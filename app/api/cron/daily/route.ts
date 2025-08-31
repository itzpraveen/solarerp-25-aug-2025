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

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1) Mark overdue invoices
  const today = dayjs().format('YYYY-MM-DD');
  await supabase
    .from('invoices')
    .update({ status: 'Overdue' })
    .lt('due_date', today)
    .neq('status', 'Paid');

  // 2) Enqueue reminders (simplified sample payloads)
  const { data: tenants } = await supabase.from('tenants').select('id');
  for (const t of tenants || []) {
    await enqueueJob(t.id, 'whatsapp_template', {
      to: '91xxxxxxxxxx',
      templateName: 'invoice_due',
      variables: ['Customer', 'INV001', '1000', today, 'https://example.com'],
    });
  }

  // 3) Follow-ups N days after KSEB submitted
  const offsets = (env.ksebFollowupDaysCsv || '7,14')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const offsetMap = new Map<number, string>(
    offsets.map((n) => [n, dayjs().subtract(n, 'day').format('YYYY-MM-DD')]),
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
          due_date: today,
        });
      }
    }
  }

  // 3b) Lead follow-up reminders
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

  // 3c) Task due/overdue reminders to assigned technicians
  // - WhatsApp via template (if phone available)
  // - Optional email via webhook (if configured)
  const emailWebhookUrl = env.emailWebhookUrl;
  const emailWebhookToken = env.emailWebhookToken;
  async function notifyEmail(toEmail: string, subject: string, text: string) {
    if (!emailWebhookUrl) return;
    try {
      await fetch(emailWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(emailWebhookToken ? { Authorization: `Bearer ${emailWebhookToken}` } : {}),
        },
        body: JSON.stringify({ to: toEmail, subject, text }),
      });
    } catch {}
  }

  const { data: dueTasks } = await supabase
    .from('tasks')
    .select('id, tenant_id, title, due_date, status, assigned_to')
    .not('status', 'in', ['Done'])
    .lte('due_date', today);
  for (const t of dueTasks || []) {
    if (!t.assigned_to) continue;
    // Lookup technician profile
    const { data: tech } = await supabase
      .from('profiles')
      .select('user_id, display_name, phone')
      .eq('user_id', t.assigned_to as any)
      .maybeSingle();
    const isOverdue = (t.due_date || '') < today;
    if (tech?.phone) {
      await enqueueJob(t.tenant_id, 'whatsapp_template', {
        to: tech.phone,
        templateName: isOverdue ? 'task_overdue' : 'task_due',
        variables: [tech.display_name || 'Technician', (t.title || 'Task'), (t.due_date || today)],
      });
    }
    // Optional email webhook
    const email = (tech as any)?.email as string | undefined; // may be null unless you store it
    if (email && emailWebhookUrl) {
      const subj = isOverdue ? 'Overdue task reminder' : 'Task due today';
      const body = `${tech.display_name || 'Technician'},\n${t.title || 'Task'} — due ${t.due_date || today}.`;
      await notifyEmail(email, subj, body);
    }
  }

  try {
    await processDueJobs();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/cron/daily', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

// Support GET so Vercel Cron (default GET) can also trigger it
export async function GET(req: NextRequest) {
  return handleCron(req);
}
