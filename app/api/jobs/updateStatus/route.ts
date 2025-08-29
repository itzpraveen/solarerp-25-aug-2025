import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { z } from 'zod';
import { JOB_STATUSES } from '@/lib/status';
import { logAudit } from '@/lib/audit';
import { env } from '@/lib/env';

async function autoCreateTasksFromTemplates(
  sb: any,
  job: any,
  newStatus: string,
) {
  try {
    const { data: tpls } = await sb
      .from('task_templates')
      .select('*')
      .eq('tenant_id', job.tenant_id)
      .eq('at_stage_trigger', newStatus);
    const list = (tpls as any[]) || [];
    if (!list.length) return;

    const program = (job as any)?.program_type || null;
    const filtered = list.filter((t) =>
      (t.program_required == null || t.program_required === program) &&
      (t.loan_only === false || t.loan_only == null),
    );
    if (!filtered.length) return;

    const { data: existing } = await sb
      .from('tasks')
      .select('id, title, template_code')
      .eq('job_id', job.id);
    const haveByCode = new Set(
      ((existing as any[]) || [])
        .map((t) => String(t.template_code || ''))
        .filter(Boolean),
    );
    const haveByTitle = new Set(
      ((existing as any[]) || []).map((t) => String(t.title || '')),
    );

    const today = new Date();
    for (const t of filtered) {
      if (haveByCode.has(String(t.code)) || haveByTitle.has(String(t.label))) {
        continue;
      }
      const due = new Date(today);
      const dd = Number(t.due_days || 0);
      if (!Number.isNaN(dd) && dd > 0) due.setDate(due.getDate() + dd);
      const { data: created } = await sb
        .from('tasks')
        .insert({
          tenant_id: job.tenant_id,
          job_id: job.id,
          template_code: t.code,
          title: t.label,
          due_date: isNaN(due.getTime()) ? null : due.toISOString().slice(0, 10),
          status: 'Open',
          priority: 'Medium',
        })
        .select('id')
        .single();
      // Audit per inserted task (best-effort)
      try {
        const { data: me2 } = await sb
          .from('profiles')
          .select('user_id, tenant_id')
          .maybeSingle();
        if (me2?.tenant_id) {
          await (sb as any).from('audit_logs').insert({
            tenant_id: (me2 as any).tenant_id,
            user_id: (me2 as any).user_id,
            action: 'tasks.create',
            entity: 'jobs',
            entity_id: job.id,
            metadata: { title: t.label, auto: true, template: t.code, taskId: (created as any)?.id },
          });
        }
      } catch {}
    }
  } catch {}
}

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

    const { error: upErr } = await sb
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', jobId);
    if (upErr) throw upErr;

    // Enforce stage gates: required tasks whose completion allows this stage
    const { data: gates } = await sb
      .from('task_templates')
      .select('code,label')
      .eq('tenant_id', (job as any).tenant_id)
      .eq('gates_stage', newStatus);
    if (gates && gates.length > 0) {
      for (const g of gates as any[]) {
        const { data: t } = await sb
          .from('tasks')
          .select('status')
          .eq('job_id', jobId)
          .or(`template_code.eq.${g.code},title.eq.${(g.label || '').replace(',', '\,')}`)
          .maybeSingle();
        if (!t || (t as any).status !== 'Done') {
          return NextResponse.json({ ok: false, error: `Complete '${g.code || g.label}' before moving to ${newStatus}` }, { status: 400 });
        }
      }
    }

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
    
    // Insert default templates for tenant if none exist (idempotent)
    const { data: anyTpl } = await sb
      .from('task_templates')
      .select('id')
      .eq('tenant_id', (job as any).tenant_id)
      .limit(1);
    if (!anyTpl || anyTpl.length === 0) {
      const defaults: any[] = [
        // Qualified
        { code: 'temp_quote', label: 'Temporary quotation', milestone: 'Sales', at_stage_trigger: 'Qualified', due_days: 1, role: 'Sales', required: true },
        { code: 'site_visit', label: 'Site visit', milestone: 'Sales', at_stage_trigger: 'Qualified', due_days: 2, role: 'Ops', required: true },
        // Quoted
        { code: 'customer_confirmation', label: 'Customer confirmation', milestone: 'Sales', at_stage_trigger: 'Quoted', due_days: 2, role: 'Sales', required: true, gates_stage: 'Won' },
        // Won
        { code: 'collect_documents', label: 'Collect documents from customer', milestone: 'Sales', at_stage_trigger: 'Won', due_days: 2, role: 'Sales', required: false },
        { code: 'pm_surya_registration', label: 'PM Surya registration', milestone: 'Regulatory', at_stage_trigger: 'Won', due_days: 2, role: 'Ops', required: true, program_required: 'PM_Surya' },
        { code: 'kseb_feasibility', label: 'KSEB feasibility', milestone: 'Regulatory', at_stage_trigger: 'Won', due_days: 5, role: 'Ops', required: true },
        { code: 'agreement_preparation', label: 'Agreement preparation', milestone: 'Sales', at_stage_trigger: 'Won', due_days: 2, role: 'Sales', required: true },
        { code: 'prepare_kseb_application', label: 'Prepare KSEB application', milestone: 'Regulatory', at_stage_trigger: 'Won', due_days: 3, role: 'Ops', required: false },
        // KSEB Submitted
        { code: 'material_dispatch', label: 'Material despatch', milestone: 'Execution', at_stage_trigger: 'KSEB_Submitted', due_days: 3, role: 'Stores', required: true },
        { code: 'install_structure', label: 'Installation: Structure work', milestone: 'Execution', at_stage_trigger: 'KSEB_Submitted', due_days: 2, role: 'Ops', required: true },
        { code: 'install_wiring', label: 'Installation: DC & AC wiring completion', milestone: 'Execution', at_stage_trigger: 'KSEB_Submitted', due_days: 3, role: 'Ops', required: true, gates_stage: 'Installed' },
        { code: 'follow_up_kseb', label: 'Follow up with KSEB', milestone: 'Regulatory', at_stage_trigger: 'KSEB_Submitted', due_days: 7, role: 'Ops', required: false },
        // Installed
        { code: 'kseb_plant_registration', label: 'KSEB paperwork: Plant registration', milestone: 'Commissioning', at_stage_trigger: 'Installed', due_days: 2, role: 'Ops', required: true },
        { code: 'net_meter_change', label: 'Plant commissioning: Net meter change', milestone: 'Commissioning', at_stage_trigger: 'Installed', due_days: 5, role: 'Ops', required: true, gates_stage: 'Net_Metered' },
        { code: 'net_metering_application', label: 'Net metering application', milestone: 'Commissioning', at_stage_trigger: 'Installed', due_days: 2, role: 'Ops', required: false },
        // Net Metered
        { code: 'post_commissioning_handover', label: 'Post commissioning visit & handover', milestone: 'Handover', at_stage_trigger: 'Net_Metered', due_days: 3, role: 'Ops', required: true, gates_stage: 'Handover' }
      ];
      await sb.from('task_templates').upsert(
        defaults.map(d => ({ tenant_id: (job as any).tenant_id, ...d })), { onConflict: 'tenant_id,code' } as any
      );
      await sb.from('task_dependencies').upsert([
        { tenant_id: (job as any).tenant_id, template_code: 'customer_confirmation', depends_on: 'temp_quote' },
        { tenant_id: (job as any).tenant_id, template_code: 'customer_confirmation', depends_on: 'site_visit' }
      ], { onConflict: 'tenant_id,template_code,depends_on' } as any);
    }

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
          const { data: me2 } = await sb
            .from('profiles')
            .select('user_id, tenant_id')
            .maybeSingle();
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
    const { data: me } = await sb
      .from('profiles')
      .select('user_id, tenant_id')
      .maybeSingle();
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
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
