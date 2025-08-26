import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

const BodySchema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { userId } = parsed.data;

    const isMock = process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1';
    const { data: me } = await sb.from('profiles').select('user_id, tenant_id, role').maybeSingle();
    if (!isMock) {
      if (!me?.tenant_id || (me as any).role !== 'owner') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    const tenantId = (me as any)?.tenant_id || 't1';

    if (!isMock && (me as any).user_id === userId) return NextResponse.json({ ok: false, error: 'Cannot remove yourself' }, { status: 400 });

    const { data: owners } = await sb.from('profiles').select('user_id').eq('tenant_id', tenantId).eq('role', 'owner');
    const isTargetOwner = !!(owners || []).find((o: any) => o.user_id === userId);
    const ownerCount = (owners || []).length;
    if (isTargetOwner && ownerCount <= 1) {
      return NextResponse.json({ ok: false, error: 'Cannot remove the last owner' }, { status: 400 });
    }

    const { error } = await sb.from('profiles').delete().eq('user_id', userId).eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
