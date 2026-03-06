import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { limitByIp } from '@/lib/rateLimit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { env } from '@/lib/env';
import { logAudit } from '@/lib/audit';
import { getCurrentProfile } from '@/lib/currentProfile';
import { canManageTargetRole, isAdminishRole } from '@/lib/teamPermissions';

const BodySchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6).max(128).optional(),
  useDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { ok } = limitByIp(req.headers, 'team:password', 30, 60_000);
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

    const { userId, password, useDefault } = parsed.data;
    const { userId: uid, profile: me } = await getCurrentProfile<{
      tenant_id: string;
      role: string;
      user_id: string;
    }>(sb as any, 'tenant_id, role, user_id');
    if (!uid)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    if (!me?.tenant_id)
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
      );
    if (!isAdminishRole((me as any).role))
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );

    if (useDefault && !env.defaultUserPassword) {
      return NextResponse.json(
        { ok: false, error: 'Default password not configured' },
        { status: 500 },
      );
    }
    if (!password && !useDefault) {
      return NextResponse.json(
        { ok: false, error: 'Password not provided' },
        { status: 400 },
      );
    }
    const nextPassword = useDefault ? env.defaultUserPassword : password;

    const { data: target } = await sb
      .from('profiles')
      .select('user_id, role')
      .eq('user_id', userId)
      .eq('tenant_id', (me as any).tenant_id)
      .maybeSingle();
    if (!target)
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 },
      );
    if (!canManageTargetRole((me as any).role, (target as any).role)) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    const admin = supabaseAdmin();
    const { error } = await (admin as any).auth.admin.updateUserById(userId, {
      password: nextPassword,
    });
    if (error)
      return NextResponse.json(
        { ok: false, error: 'Password update failed' },
        { status: 500 },
      );

    await logAudit(sb as any, {
      tenantId: (me as any).tenant_id,
      userId: (me as any).user_id,
      action: 'team.reset_password',
      entity: 'profiles',
      entityId: userId,
      metadata: { useDefault: !!useDefault },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/team/password', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
