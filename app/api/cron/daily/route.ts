import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { env } from '@/lib/env';
import { enqueueJob, processDueJobs } from '@/lib/queue';
import { secureEqual } from '@/lib/secureCompare';
import { getBaseUrl } from '@/lib/baseUrl';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get('token') || '';
  const secret = process.env.CRON_SECRET || '';

  const bearerOk = !!secret && secureEqual(bearer, secret);
  const queryOk = !!secret && secureEqual(tokenParam, secret);
  return bearerOk || queryOk;
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1) Mark overdue invoices (only Sent -> Overdue)
  const today = dayjs().format('YYYY-MM-DD');
  const { data: newlyOverdue } = await supabase
    .from('invoices')
    .update({ status: 'Overdue' })
    .lt('due_date', today)
    .eq('status', 'Sent')
    .select('id');

  // 2) Enqueue reminders for invoices due today and newly overdue
  const invoiceSelect =
    'id, tenant_id, job_id, invoice_type, total, due_date, pdf_url, jobs(id, customers(name, phone))';
  const { data: dueToday } = await supabase
    .from('invoices')
    .select(invoiceSelect)
    .eq('due_date', today)
    .eq('status', 'Sent');
  const overdueIds = (newlyOverdue || []).map((r: any) => r.id).filter(Boolean);
  const { data: overdueRows } = overdueIds.length
    ? await supabase.from('invoices').select(invoiceSelect).in('id', overdueIds as any)
    : { data: [] };

  async function resolveInvoiceLink(inv: any): Promise<string> {
    const key = String(inv?.pdf_url || '');
    if (key) {
      if (/^https?:\/\//i.test(key)) return key;
      try {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(key, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) return signed.signedUrl;
      } catch {}
    }
    const base = getBaseUrl();
    return inv?.job_id ? `${base}/jobs/${inv.job_id}?tab=finance` : base;
  }

  const reminders = [...(dueToday || []), ...(overdueRows || [])];
  for (const inv of reminders) {
    const customer = (inv as any)?.jobs?.customers || {};
    const phone = String(customer?.phone || '').trim();
    if (!phone) continue;
    const name = String(customer?.name || 'Customer');
    const totalNum = Number(inv.total || 0);
    const amountText = Number.isFinite(totalNum)
      ? totalNum.toFixed(2)
      : String(inv.total || '0');
    const shortId = String(inv.id || '').slice(0, 8);
    const label = inv.invoice_type
      ? `${inv.invoice_type}${shortId ? ` ${shortId}` : ''}`
      : shortId
        ? `INV-${shortId}`
        : 'Invoice';
    const link = await resolveInvoiceLink(inv);
    await enqueueJob(inv.tenant_id, 'whatsapp_template', {
      to: phone,
      templateName: 'invoice_due',
      variables: [name, label, amountText, inv.due_date || today, link],
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
    .neq('status', 'Converted')
    .neq('status', 'Closed')
    .neq('status', 'Lost')
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
  const emailCache = new Map<string, string | null>();
  async function getUserEmail(userId: string): Promise<string | null> {
    if (!emailWebhookUrl) return null;
    if (emailCache.has(userId)) return emailCache.get(userId) || null;
    try {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) throw error;
      const email = data?.user?.email || null;
      emailCache.set(userId, email);
      return email;
    } catch {
      emailCache.set(userId, null);
      return null;
    }
  }

  const { data: dueTasks } = await supabase
    .from('tasks')
    .select('id, tenant_id, title, due_date, status, assigned_to')
    .neq('status', 'Done')
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
        variables: [tech?.display_name || 'Technician', (t.title || 'Task'), (t.due_date || today)],
      });
    }
    // Optional email webhook
    const email = await getUserEmail(String(t.assigned_to));
    if (email && emailWebhookUrl) {
      const subj = isOverdue ? 'Overdue task reminder' : 'Task due today';
      const body = `${tech?.display_name || 'Technician'},\n${t.title || 'Task'} — due ${t.due_date || today}.`;
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
