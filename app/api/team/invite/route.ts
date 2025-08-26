import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getDbRef } from '@/lib/supabaseMock';

const BodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'staff']).default('staff'),
});

function isMock() {
  return process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1';
}

export async function POST(req: NextRequest) {
  try {
    const ip = ipFromHeaders(req.headers);
    const { ok } = await takeToken(`team:invite:${ip}`, 30, 60_000);
    if (!ok) return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
    // Ensure caller is authenticated and is an owner
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { email, role } = parsed.data;

    const { data: me } = await sb.from('profiles').select('tenant_id, role').maybeSingle();
    if (!me?.tenant_id) return NextResponse.json({ ok: false, error: 'Profile not ready' }, { status: 400 });
    if ((me as any).role !== 'owner') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const tenantId = (me as any).tenant_id as string;

    // Mock mode: create a user + profile in the in-memory DB
    if (isMock()) {
      const db = getDbRef();
      const existing = db.users.find((u) => u.email === email);
      const userId = existing?.id || `u_${Math.random().toString(36).slice(2, 10)}`;
      if (!existing) db.users.push({ id: userId, email });
      const prof = db.profiles.find((p) => p.user_id === userId);
      if (prof) {
        prof.tenant_id = tenantId;
        prof.role = role;
        prof.display_name = email.split('@')[0];
      } else {
        db.profiles.push({ user_id: userId, tenant_id: tenantId, role, display_name: email.split('@')[0] });
      }
      return NextResponse.json({ ok: true, userId });
    }

    // Real environment: invite or create the user and upsert profile
    const admin = supabaseAdmin();
    // Try invite; if it fails due to existing, list users and match by email
    let userId: string | null = null;
    try {
      const { data: invited } = await (admin as any).auth.admin.inviteUserByEmail(email);
      userId = invited?.user?.id || null;
    } catch (_) {}

    if (!userId) {
      try {
        const { data: created } = await (admin as any).auth.admin.createUser({ email, email_confirm: false });
        userId = created?.user?.id || null;
      } catch (_) {}
    }

    if (!userId) {
      try {
        const { data: list } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = list?.users?.find((u: any) => String(u?.email).toLowerCase() === email.toLowerCase());
        userId = found?.id || null;
      } catch (_) {}
    }

    if (!userId) return NextResponse.json({ ok: false, error: 'Unable to invite or create user' }, { status: 500 });

    await admin.from('profiles').upsert({ user_id: userId, tenant_id: tenantId, role, display_name: email.split('@')[0] });

    // Best-effort audit
    await logAudit((sb as any), {
      tenantId,
      userId: (me as any)?.user_id,
      action: 'team.invite',
      entity: 'profiles',
      entityId: userId,
      metadata: { email, role },
    });

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/team/invite', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
