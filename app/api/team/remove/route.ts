import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';

const BodySchema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const ip = ipFromHeaders(req.headers);
    const { ok } = takeToken(`team:remove:${ip}`, 60, 60_000);
    if (!ok)
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded' },
        { status: 429 },
      );
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );
    const { userId } = parsed.data;

    const isMock =
      process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1';
    const { data: me } = await sb
      .from('profiles')
      .select('user_id, tenant_id, role')
      .maybeSingle();
    if (!isMock) {
      if (!me?.tenant_id || !['owner', 'admin'].includes((me as any).role))
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403 },
        );
    }
    const tenantId = (me as any)?.tenant_id || 't1';

    if (!isMock && (me as any).user_id === userId)
      return NextResponse.json(
        { ok: false, error: 'Cannot remove yourself' },
        { status: 400 },
      );

    // Enforce at least one admin-ish (owner/admin) remains
    const { data: admins } = await sb
      .from('profiles')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin'] as any);
    const isTargetAdminish = !!(admins || []).find(
      (o: any) => o.user_id === userId,
    );
    const adminishCount = (admins || []).length;
    if (isTargetAdminish && adminishCount <= 1) {
      return NextResponse.json(
        { ok: false, error: 'Cannot remove the last admin' },
        { status: 400 },
      );
    }

    const { error } = await sb
      .from('profiles')
      .delete()
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);
    if (error) {
      const id = Math.random().toString(36).slice(2, 10);
      console.error('api/team/remove db', { id, error });
      return NextResponse.json(
        { ok: false, error: 'Internal error', id },
        { status: 500 },
      );
    }
    await logAudit(sb as any, {
      tenantId,
      userId: (me as any)?.user_id,
      action: 'team.remove',
      entity: 'profiles',
      entityId: userId,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/team/remove', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
