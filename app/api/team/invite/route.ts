import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const BodySchema = z.object({
  email: z.string().email(),
  role: z
    .enum([
      'owner',
      'admin',
      'manager',
      'sales',
      'technician',
      'accountant',
      'viewer',
      'staff',
    ])
    .default('staff'),
});

export async function POST(req: NextRequest) {
  try {
    const ip = ipFromHeaders(req.headers);
    const { ok } = takeToken(`team:invite:${ip}`, 30, 60_000);
    if (!ok)
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded' },
        { status: 429 },
      );
    // Ensure caller is authenticated and is an owner
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
    const { email, role } = parsed.data;

    const { data: authUser } = await (sb as any).auth.getUser();
    const uid = (authUser?.user as any)?.id as string | undefined;
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

    const tenantId = (me as any).tenant_id as string;

    // Real environment: invite or create the user and upsert profile
    const admin = supabaseAdmin();
    // Try invite; if it fails due to existing, list users and match by email
    let userId: string | null = null;
    try {
      const { data: invited } = await (
        admin as any
      ).auth.admin.inviteUserByEmail(email);
      userId = invited?.user?.id || null;
    } catch (_) {}

    if (!userId) {
      try {
        const { data: created } = await (admin as any).auth.admin.createUser({
          email,
          email_confirm: false,
        });
        userId = created?.user?.id || null;
      } catch (_) {}
    }

    if (!userId) {
      try {
        const { data: list } = await (admin as any).auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const found = list?.users?.find(
          (u: any) => String(u?.email).toLowerCase() === email.toLowerCase(),
        );
        userId = found?.id || null;
      } catch (_) {}
    }

    if (!userId)
      return NextResponse.json(
        { ok: false, error: 'Unable to invite or create user' },
        { status: 500 },
      );

    await admin.from('profiles').upsert({
      user_id: userId,
      tenant_id: tenantId,
      role,
      display_name: email.split('@')[0],
    });

    // Best-effort audit
    await logAudit(sb as any, {
      tenantId,
      userId: uid,
      action: 'team.invite',
      entity: 'profiles',
      entityId: userId,
      metadata: { email, role },
    });

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/team/invite', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
