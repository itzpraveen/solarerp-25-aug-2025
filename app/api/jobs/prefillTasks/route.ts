import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import {
  autoCreateTasksFromTemplates,
  ensureDefaultTaskTemplates,
} from '@/lib/taskTemplates';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const Body = z.object({ jobId: z.string().uuid() });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );
    const { jobId } = parsed.data;

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

    // Seed defaults for fresh tenants, then create tasks for current status
    await ensureDefaultTaskTemplates(sb, (job as any).tenant_id);
    await autoCreateTasksFromTemplates(sb, job, (job as any).status);

    // Audit (best-effort)
    try {
      const { data: me } = await sb
        .from('profiles')
        .select('user_id, tenant_id')
        .maybeSingle();
      if (me?.tenant_id) {
        await logAudit(sb as any, {
          tenantId: me.tenant_id,
          userId: (me as any).user_id,
          action: 'tasks.prefill_from_templates',
          entity: 'jobs',
          entityId: jobId,
          metadata: { status: (job as any).status },
        });
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/jobs/prefillTasks', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}

