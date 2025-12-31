import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { limitByIp } from '@/lib/rateLimit';

const BodySchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(120).optional(),
  phone: z.string().min(0).max(32).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Apply per-IP rate limit: up to 60 requests/minute for this endpoint
    const { ok } = limitByIp(req.headers, 'team:member', 60, 60_000);
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
    const { userId, displayName, phone } = parsed.data;
    const { data: authUser } = await (sb as any).auth.getUser();
    const uid = (authUser?.user as any)?.id as string | undefined;
    if (!uid)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    const { data: me } = await sb
      .from('profiles')
      .select('tenant_id, role')
      .eq('user_id', uid as any)
      .maybeSingle();
    if (!me?.tenant_id)
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
      );
    if (!['owner', 'admin'].includes((me as any).role))
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );

    const patch: any = {};
    if (displayName !== undefined) patch.display_name = displayName;
    if (phone !== undefined) patch.phone = phone || null;
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

    const { error } = await sb
      .from('profiles')
      .update(patch)
      .eq('user_id', userId)
      .eq('tenant_id', (me as any).tenant_id);
    if (error)
      return NextResponse.json(
        { ok: false, error: 'Update failed' },
        { status: 500 },
      );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/team/member', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
