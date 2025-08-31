// Utilities to manage task templates and prefill tasks for jobs
// Kept intentionally light on types (any) to minimize churn.

export async function ensureDefaultTaskTemplates(sb: any, tenantId: string) {
  try {
    const { data: anyTpl } = await sb
      .from('task_templates')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);
    if (anyTpl && anyTpl.length > 0) return;

    const defaults: any[] = [
      // Qualified
      {
        code: 'temp_quote',
        label: 'Temporary quotation making',
        milestone: 'Sales',
        at_stage_trigger: 'Qualified',
        due_days: 1,
        role: 'Sales',
        required: true,
      },
      {
        code: 'site_visit',
        label: 'Site visit',
        milestone: 'Sales',
        at_stage_trigger: 'Qualified',
        due_days: 2,
        role: 'Ops',
        required: true,
      },
      // Quoted
      {
        code: 'customer_confirmation',
        label: 'Project confirmation by customer',
        milestone: 'Sales',
        at_stage_trigger: 'Quoted',
        due_days: 2,
        role: 'Sales',
        required: true,
        gates_stage: 'Won',
      },
      // Won
      {
        code: 'collect_documents',
        label: 'Collect documents from customer',
        milestone: 'Sales',
        at_stage_trigger: 'Won',
        due_days: 2,
        role: 'Sales',
        required: false,
      },
      {
        code: 'pm_surya_registration',
        label: 'PM Surya registration',
        milestone: 'Regulatory',
        at_stage_trigger: 'Won',
        due_days: 2,
        role: 'Ops',
        required: true,
        program_required: 'PM_Surya',
      },
      // Loan scheme (optional)
      {
        code: 'jan_samarth_registration',
        label: 'Jan Samarth portal registration',
        milestone: 'Finance',
        at_stage_trigger: 'Won',
        due_days: 3,
        role: 'Sales',
        required: false,
        loan_only: true,
      },
      {
        code: 'bank_loan_application',
        label: 'Bank loan application',
        milestone: 'Finance',
        at_stage_trigger: 'Won',
        due_days: 5,
        role: 'Sales',
        required: false,
        loan_only: true,
      },
      {
        code: 'kseb_feasibility',
        label: 'Feasibility from KSEBL section',
        milestone: 'Regulatory',
        at_stage_trigger: 'Won',
        due_days: 5,
        role: 'Ops',
        required: true,
      },
      {
        code: 'agreement_preparation',
        label: 'Agreement preparation',
        milestone: 'Sales',
        at_stage_trigger: 'Won',
        due_days: 2,
        role: 'Sales',
        required: true,
      },
      {
        code: 'prepare_kseb_application',
        label: 'Prepare KSEB application',
        milestone: 'Regulatory',
        at_stage_trigger: 'Won',
        due_days: 3,
        role: 'Ops',
        required: false,
      },
      // KSEB Submitted
      {
        code: 'material_dispatch',
        label: 'Material despatch',
        milestone: 'Execution',
        at_stage_trigger: 'KSEB_Submitted',
        due_days: 3,
        role: 'Stores',
        required: true,
      },
      {
        code: 'install_structure',
        label: 'Installation: Structure work',
        milestone: 'Execution',
        at_stage_trigger: 'KSEB_Submitted',
        due_days: 2,
        role: 'Ops',
        required: true,
      },
      {
        code: 'install_wiring',
        label: 'Installation: DC and AC side wiring completion',
        milestone: 'Execution',
        at_stage_trigger: 'KSEB_Submitted',
        due_days: 3,
        role: 'Ops',
        required: true,
        gates_stage: 'Installed',
      },
      {
        code: 'follow_up_kseb',
        label: 'Follow up with KSEB',
        milestone: 'Regulatory',
        at_stage_trigger: 'KSEB_Submitted',
        due_days: 7,
        role: 'Ops',
        required: false,
      },
      // Installed
      {
        code: 'kseb_plant_registration',
        label: 'KSEB paperwork: Plant registration',
        milestone: 'Commissioning',
        at_stage_trigger: 'Installed',
        due_days: 2,
        role: 'Ops',
        required: true,
      },
      {
        code: 'net_meter_change',
        label: 'Plant commissioning: Net meter change',
        milestone: 'Commissioning',
        at_stage_trigger: 'Installed',
        due_days: 5,
        role: 'Ops',
        required: true,
        gates_stage: 'Net_Metered',
      },
      {
        code: 'ksebl_plant_registration',
        label: 'KSEBL paperwork: plant registration',
        milestone: 'Commissioning',
        at_stage_trigger: 'Installed',
        due_days: 2,
        role: 'Ops',
        required: true,
        gates_stage: 'Net_Metered',
      },
      // Net Metered
      {
        code: 'post_commissioning_handover',
        label: 'Post commissioning visit and documents handover',
        milestone: 'Handover',
        at_stage_trigger: 'Net_Metered',
        due_days: 3,
        role: 'Ops',
        required: true,
        gates_stage: 'Handover',
      },
    ];

    await sb
      .from('task_templates')
      .upsert(
        defaults.map((d: any) => ({ tenant_id: tenantId, ...d })),
        { onConflict: 'tenant_id,code' } as any,
      );
    await sb
      .from('task_dependencies')
      .upsert(
        [
          {
            tenant_id: tenantId,
            template_code: 'customer_confirmation',
            depends_on: 'temp_quote',
          },
          {
            tenant_id: tenantId,
            template_code: 'customer_confirmation',
            depends_on: 'site_visit',
          },
        ],
        { onConflict: 'tenant_id,template_code,depends_on' } as any,
      );
  } catch {
    // ignore – best effort
  }
}

export async function autoCreateTasksFromTemplates(
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
    const filtered = list.filter((t) => {
      const programOk =
        t.program_required == null || t.program_required === program;
      const loanOk = !t.loan_only || (job as any)?.is_loan === true;
      return programOk && loanOk;
    });
    if (!filtered.length) return;

    const { data: existing } = await sb
      .from('tasks')
      .select('id, title, template_code')
      .eq('job_id', job.id);
    const haveByCode = new Set(
      ((existing as any[]) || [])
        .map((t: any) => String(t.template_code || ''))
        .filter(Boolean),
    );
    const haveByTitle = new Set(
      ((existing as any[]) || []).map((t: any) => String(t.title || '')),
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
          due_date: isNaN(due.getTime())
            ? null
            : due.toISOString().slice(0, 10),
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
            metadata: {
              title: t.label,
              auto: true,
              template: t.code,
              taskId: (created as any)?.id,
            },
          });
        }
      } catch {}
    }
  } catch {}
}
