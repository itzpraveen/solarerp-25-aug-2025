import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({
  mode: z.enum(['current', 'user', 'all-missing']).default('current'),
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
  role: z
    .enum(['owner', 'admin', 'manager', 'sales', 'technician', 'accountant', 'viewer', 'staff'])
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { data: meAuth } = await sb.auth.getUser();
    const callerId = (meAuth?.user as any)?.id as string | undefined;
    if (!callerId)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { data: me } = await sb
      .from('profiles')
      .select('tenant_id, role, display_name')
      .eq('user_id', callerId)
      .maybeSingle();
    const tenantId = (me as any)?.tenant_id as string | undefined;
    const callerRole = (me as any)?.role as string | undefined;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: 'Profile not ready' }, { status: 400 });
    if (!['owner', 'admin'].includes(callerRole || ''))
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const parsed = Body.safeParse(await req.json().catch(() => ({ mode: 'current' })));
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { mode, email, userId, role } = parsed.data;

    const admin = supabaseAdmin();

    // Helper: upsert profile for a single user
    const upsertProfile = async (uid: string, r: string, name?: string | null) => {
      await admin.from('profiles').upsert({
        user_id: uid,
        tenant_id: tenantId,
        role: r,
        display_name: name || me?.display_name || null,
      });
    };

    if (mode === 'current') {
      await upsertProfile(callerId, role || 'owner');
      return NextResponse.json({ ok: true, updated: 1, mode });
    }

    if (mode === 'user') {
      let targetId = userId || '';
      let displayName: string | null = null;
      if (!targetId && email) {
        const { data: list } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = list?.users?.find((u: any) => String(u?.email).toLowerCase() === email.toLowerCase());
        targetId = found?.id || '';
        displayName = (found?.user_metadata?.name as string) || (found?.email?.split('@')[0] as string) || null;
      }
      if (!targetId)
        return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
      await upsertProfile(targetId, role || 'staff', displayName);
      return NextResponse.json({ ok: true, updated: 1, mode });
    }

    // all-missing: upsert profiles for every auth user missing one, mapping them to caller's tenant as 'staff'
    if (mode === 'all-missing') {
      const { data: list } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
      const users: any[] = list?.users || [];
      // Fetch existing profile user_ids to avoid touching mapped users
      const { data: existing } = await admin.from('profiles').select('user_id');
      const have = new Set((existing || []).map((r: any) => String(r.user_id)));
      let count = 0;
      for (const u of users) {
        if (!u?.id || have.has(String(u.id))) continue;
        const name = (u?.user_metadata?.name as string) || (u?.email?.split('@')[0] as string) || null;
        await upsertProfile(u.id, role || 'staff', name);
        count++;
      }
      return NextResponse.json({ ok: true, updated: count, mode });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported mode' }, { status: 400 });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/ops/backfill-profiles', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}

