import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';

const BodySchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['owner', 'staff']),
});

export async function POST(req: NextRequest) {
  try {
    const ip = ipFromHeaders(req.headers);
    const { ok } = await takeToken(`team:role:${ip}`, 60, 60_000);
    if (!ok) return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { userId, role } = parsed.data;

    const isMock = process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1';
    const { data: me } = await sb.from('profiles').select('user_id, tenant_id, role').maybeSingle();
    if (!isMock) {
      if (!me?.tenant_id || (me as any).role !== 'owner') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    const tenantId = ((me as any)?.tenant_id as string) || 't1';

    // Prevent removing last owner
    const { data: owners } = await sb.from('profiles').select('user_id').eq('tenant_id', tenantId).eq('role', 'owner');
    const isTargetOwner = !!(owners || []).find((o: any) => o.user_id === userId);
    const ownerCount = (owners || []).length;
    if (isTargetOwner && role !== 'owner' && ownerCount <= 1) {
      return NextResponse.json({ ok: false, error: 'Cannot demote the last owner' }, { status: 400 });
    }
    // Optional: prevent self-demotion if last owner
    if (!isMock && (me as any).user_id === userId && role !== 'owner' && ownerCount <= 1) {
      return NextResponse.json({ ok: false, error: 'Add another owner before demoting yourself' }, { status: 400 });
    }

    const { error } = await sb.from('profiles').update({ role }).eq('user_id', userId).eq('tenant_id', tenantId);
    if (error) {
      const id = Math.random().toString(36).slice(2, 10);
      console.error('api/team/role db', { id, error });
      return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
    }
    // Audit
    await logAudit((sb as any), {
      tenantId,
      userId: (me as any)?.user_id,
      action: 'team.change_role',
      entity: 'profiles',
      entityId: userId,
      metadata: { role },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/team/role', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
