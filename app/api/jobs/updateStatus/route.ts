import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { z } from 'zod';
import { JOB_STATUSES } from '@/lib/status';
import { logAudit } from '@/lib/audit';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    const Body = z.object({ jobId: z.string().uuid(), newStatus: z.enum([...JOB_STATUSES]) });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { jobId, newStatus } = parsed.data;
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // Load job under RLS
    const { data: job, error: jErr } = await sb.from('jobs').select('*').eq('id', jobId).single();
    if (jErr || !job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const { error: upErr } = await sb.from('jobs').update({ status: newStatus }).eq('id', jobId);
    if (upErr) throw upErr;

    if (newStatus === 'Won') {
      const { data: settings } = await sb.from('settings').select('*').eq('tenant_id', job.tenant_id).single();
      const depositPercent = Number((settings as any)?.deposit_percent || 0);
      const total = Number(job.total_amount || job.quoted_price || 0);
      const deposit = Math.round((total * depositPercent) / 100);
      if (deposit > 0) {
        // Avoid duplicate deposit invoices for this job
        const { data: existing } = await sb
          .from('invoices')
          .select('id')
          .eq('job_id', job.id)
          .eq('invoice_type', 'Deposit')
          .limit(1);
        if (!existing || existing.length === 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + Number(env.depositDueDays || 7));
          await sb.from('invoices').insert({
            tenant_id: job.tenant_id,
            job_id: job.id,
            date: new Date().toISOString().slice(0, 10),
            invoice_type: 'Deposit',
            amount_before_tax: deposit,
            tax: 0,
            total: deposit,
            due_date: dueDate.toISOString().slice(0, 10),
            status: 'Draft',
          });
          await sb
            .from('jobs')
            .update({ deposit_amount: deposit, balance_due: total - deposit })
            .eq('id', job.id);
        }
      }
    }

    // Auto-create task checklist for key statuses (idempotent by title)
    const templates: Record<string, Array<{ title: string; dueDays: number; priority: 'Low' | 'Medium' | 'High' | 'Urgent' }>> = {
      Won: [
        { title: 'Collect documents from customer', dueDays: 2, priority: 'High' },
        { title: 'Prepare KSEB application', dueDays: 3, priority: 'High' },
      ],
      KSEB_Submitted: [
        { title: 'Follow up with KSEB', dueDays: 7, priority: 'Medium' },
      ],
      Installed: [
        { title: 'Net metering application', dueDays: 2, priority: 'High' },
      ],
      Net_Metered: [
        { title: 'Customer training and handover', dueDays: 1, priority: 'Medium' },
      ],
    };
    const tmpl = templates[newStatus];
    if (tmpl && tmpl.length) {
      const { data: existing } = await sb.from('tasks').select('title').eq('job_id', jobId);
      const have = new Set((existing || []).map((t: any) => String(t.title || '')));
      const today = new Date();
      for (const t of tmpl) {
        if (have.has(t.title)) continue;
        const due = new Date(today);
        due.setDate(due.getDate() + t.dueDays);
        await sb.from('tasks').insert({
          tenant_id: job.tenant_id,
          job_id: job.id,
          title: t.title,
          due_date: due.toISOString().slice(0, 10),
          priority: t.priority,
          status: 'Open',
        });
        // Audit each auto-created task
        try {
          const { data: me2 } = await sb.from('profiles').select('user_id, tenant_id').maybeSingle();
          if (me2?.tenant_id) {
            await (sb as any).from('audit_logs').insert({
              tenant_id: (me2 as any).tenant_id,
              user_id: (me2 as any).user_id,
              action: 'tasks.create',
              entity: 'jobs',
              entity_id: jobId,
              metadata: { title: t.title, auto: true },
            });
          }
        } catch {}
      }
    }

    // Audit log (best-effort)
    const { data: me } = await sb.from('profiles').select('user_id, tenant_id').maybeSingle();
    if (me?.tenant_id) {
      await logAudit(sb as any, {
        tenantId: me.tenant_id,
        userId: (me as any).user_id,
        action: 'jobs.update_status',
        entity: 'jobs',
        entityId: jobId,
        metadata: { newStatus },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/jobs/updateStatus', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
