import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';
import { can, type Role } from '@/lib/authz';

const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ['Sent', 'Cancelled'],
  Sent: ['Paid', 'Overdue', 'Cancelled'],
  Overdue: ['Paid', 'Cancelled'],
  Paid: [],
  Cancelled: [],
};

const Body = z.object({
  invoiceId: z.string().uuid(),
  newStatus: z.enum(['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );

    const { invoiceId, newStatus } = parsed.data;
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
    const { data: me } = await sb
      .from('profiles')
      .select('user_id, tenant_id, role')
      .eq('user_id', uid)
      .maybeSingle();
    if (!(me as any)?.tenant_id) {
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
      );
    }
    if (!can(((me as any)?.role || null) as Role | null, 'invoices.edit')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    const { data: invoice, error: iErr } = await sb
      .from('invoices')
      .select('id, status, job_id')
      .eq('id', invoiceId)
      .single();
    if (iErr || !invoice)
      return NextResponse.json(
        { ok: false, error: 'Invoice not found' },
        { status: 404 },
      );

    const currentStatus = (invoice as any).status || 'Draft';
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot change from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        },
        { status: 400 },
      );
    }

    const { error: upErr } = await sb
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoiceId);
    if (upErr)
      return NextResponse.json(
        { ok: false, error: upErr.message },
        { status: 500 },
      );

    if ((me as any)?.tenant_id) {
      await logAudit(sb as any, {
        tenantId: (me as any).tenant_id,
        userId: (me as any).user_id,
        action: 'invoices.update_status',
        entity: 'invoices',
        entityId: invoiceId,
        metadata: {
          from: currentStatus,
          to: newStatus,
          jobId: (invoice as any).job_id,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/invoices/updateStatus', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
