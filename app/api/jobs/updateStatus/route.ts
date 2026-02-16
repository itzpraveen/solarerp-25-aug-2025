import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { z } from 'zod';
import { JOB_STATUSES } from '@/lib/status';
import { logAudit } from '@/lib/audit';
import { env } from '@/lib/env';
import { can, type Role } from '@/lib/authz';
import {
  autoCreateTasksFromTemplates,
  ensureDefaultTaskTemplates,
} from '@/lib/taskTemplates';

// moved to src/lib/taskTemplates

export async function POST(req: NextRequest) {
  try {
    const Body = z.object({
      jobId: z.string().uuid(),
      newStatus: z.enum([...JOB_STATUSES]),
    });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );
    const { jobId, newStatus } = parsed.data;
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    const { data: authUser, error: authErr } = await sb.auth.getUser();
    const uid = authUser?.user?.id;
    if (authErr || !uid) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    const { data: meProfile } = await sb
      .from('profiles')
      .select('user_id, tenant_id, role')
      .eq('user_id', uid)
      .maybeSingle();
    if (!(meProfile as any)?.tenant_id) {
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
      );
    }
    if (!can(((meProfile as any)?.role || null) as Role | null, 'jobs.edit')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    // Load job under RLS
    const { data: job, error: jErr } = await sb
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    if (jErr || !job)
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404 },
      );

    // Ensure default templates exist for new tenants before gates/tasks
    await ensureDefaultTaskTemplates(sb, (job as any).tenant_id);

    // Enforce stage gates: required tasks whose completion allows this stage
    const { data: gates } = await sb
      .from('task_templates')
      .select('code,label')
      .eq('tenant_id', (job as any).tenant_id)
      .eq('gates_stage', newStatus);
    if (gates && gates.length > 0) {
      for (const g of gates as any[]) {
        const label = String(g.label || '');
        const safeLabel = label ? label.replace(/,/g, '\\,') : '';
        let q = sb.from('tasks').select('status').eq('job_id', jobId);
        if (safeLabel) {
          q = q.or(`template_code.eq.${g.code},title.eq.${safeLabel}`);
        } else {
          q = q.eq('template_code', g.code);
        }
        const { data: t } = await q.maybeSingle();
        if (!t || (t as any).status !== 'Done') {
          return NextResponse.json({ ok: false, error: `Complete '${g.code || g.label}' before moving to ${newStatus}` }, { status: 400 });
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const datePatch: Record<string, string> = {};
    if (newStatus === 'Quoted' && !(job as any)?.date_quote) {
      datePatch.date_quote = today;
    }
    if (newStatus === 'Won' && !(job as any)?.date_won) {
      datePatch.date_won = today;
    }
    if (newStatus === 'KSEB_Submitted' && !(job as any)?.date_kseb_submit) {
      datePatch.date_kseb_submit = today;
    }
    if (newStatus === 'Installed' && !(job as any)?.date_install) {
      datePatch.date_install = today;
    }
    if (newStatus === 'Net_Metered' && !(job as any)?.date_meter) {
      datePatch.date_meter = today;
    }
    if (newStatus === 'Handover' && !(job as any)?.date_handover) {
      datePatch.date_handover = today;
    }
    const updatePayload = { status: newStatus, ...datePatch };
    const { error: upErr } = await sb
      .from('jobs')
      .update(updatePayload)
      .eq('id', jobId);
    if (upErr) throw upErr;

    // Create tasks defined for this stage (idempotent)
    await autoCreateTasksFromTemplates(sb, job, newStatus);

    if (newStatus === 'Won') {
      const { data: settings } = await sb
        .from('settings')
        .select('*')
        .eq('tenant_id', job.tenant_id)
        .single();
      const depositPercent = Number((settings as any)?.deposit_percent || 0);
      const total = Number(job.total_amount || job.quoted_price || 0);
      const depositRaw = (total * depositPercent) / 100;
      const deposit = Math.round(depositRaw * 100) / 100;
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

          // Use tenant's default tax rate instead of hardcoded 0
          const taxRate = Number((settings as any)?.default_tax_rate || 0);
          const taxAmount = Math.round((deposit * taxRate / 100) * 100) / 100;
          const invoiceTotal = Math.round((deposit + taxAmount) * 100) / 100;

          // Generate sequential invoice number
          const nextNum = Number((settings as any)?.next_invoice_number || 1);
          const prefix = (settings as any)?.invoice_prefix || 'INV';
          const invoiceNumber = `${prefix}-${String(nextNum).padStart(5, '0')}`;

          const { error: invInsertErr } = await sb.from('invoices').insert({
            tenant_id: job.tenant_id,
            job_id: job.id,
            date: new Date().toISOString().slice(0, 10),
            invoice_type: 'Deposit',
            amount_before_tax: deposit,
            tax: taxAmount,
            total: invoiceTotal,
            due_date: dueDate.toISOString().slice(0, 10),
            status: 'Draft',
            invoice_number: invoiceNumber,
          });
          if (invInsertErr) throw invInsertErr;

          // Increment the invoice counter
          const { error: settingsErr } = await sb
            .from('settings')
            .update({ next_invoice_number: nextNum + 1 })
            .eq('tenant_id', job.tenant_id);
          if (settingsErr) throw settingsErr;

          const balance = Math.round((total - invoiceTotal) * 100) / 100;
          const { error: jobFinanceErr } = await sb
            .from('jobs')
            .update({ deposit_amount: deposit, balance_due: balance })
            .eq('id', job.id);
          if (jobFinanceErr) throw jobFinanceErr;
        }
      }
    }

    // Auto-create task checklist for key statuses (legacy fallback + templates)
    const templates: Record<
      string,
      Array<{
        title: string;
        dueDays: number;
        priority: 'Low' | 'Medium' | 'High' | 'Urgent';
      }>
    > = {
      Won: [
        {
          title: 'Collect documents from customer',
          dueDays: 2,
          priority: 'High',
        },
        { title: 'Prepare KSEB application', dueDays: 3, priority: 'High' },
      ],
      KSEB_Submitted: [
        { title: 'Follow up with KSEB', dueDays: 7, priority: 'Medium' },
      ],
      Installed: [
        { title: 'Net metering application', dueDays: 2, priority: 'High' },
      ],
      Net_Metered: [
        {
          title: 'Customer training and handover',
          dueDays: 1,
          priority: 'Medium',
        },
      ],
    };
    
    const tmpl = templates[newStatus];
    if (tmpl && tmpl.length) {

      const { data: existing } = await sb
        .from('tasks')
        .select('title')
        .eq('job_id', jobId);
      const have = new Set(
        (existing || []).map((t: any) => String(t.title || '')),
      );
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
          if ((meProfile as any)?.tenant_id) {
            await (sb as any).from('audit_logs').insert({
              tenant_id: (meProfile as any).tenant_id,
              user_id: (meProfile as any).user_id,
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
    if ((meProfile as any)?.tenant_id) {
      await logAudit(sb as any, {
        tenantId: (meProfile as any).tenant_id,
        userId: (meProfile as any).user_id,
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
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
