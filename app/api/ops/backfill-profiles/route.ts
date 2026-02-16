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

const AUTH_USERS_PER_PAGE = 1000;
const AUTH_USERS_MAX_PAGES = 20;

async function listAllAuthUsers(admin: any) {
  const out: any[] = [];
  for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });
    if (error) throw error;
    const users: any[] = data?.users || [];
    out.push(...users);
    if (users.length < AUTH_USERS_PER_PAGE) break;
  }
  return out;
}

async function findAuthUserByEmail(admin: any, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });
    if (error) throw error;
    const users: any[] = data?.users || [];
    const found = users.find(
      (u) => String(u?.email || '').toLowerCase() === target,
    );
    if (found) return found;
    if (users.length < AUTH_USERS_PER_PAGE) break;
  }
  return null;
}

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

    const allowBackfill =
      process.env.ENABLE_PROFILE_BACKFILL === '1' ||
      process.env.NODE_ENV !== 'production';
    if (!allowBackfill) {
      return NextResponse.json(
        { ok: false, error: 'Backfill is disabled in production' },
        { status: 403 },
      );
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({ mode: 'current' })));
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { mode, email, userId, role } = parsed.data;

    const admin = supabaseAdmin();

    // Helper: create profile only when missing; never reassign users across tenants.
    const ensureProfile = async (uid: string, r: string, name?: string | null) => {
      const { data: existing, error: existingErr } = await admin
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', uid)
        .maybeSingle();
      if (existingErr) throw existingErr;
      const existingTenantId = (existing as any)?.tenant_id as string | undefined;
      if (existingTenantId && existingTenantId !== tenantId) {
        return { crossTenant: true as const };
      }
      const display_name = name || me?.display_name || null;
      const payload = { role: r, display_name };
      if (existingTenantId) {
        const { error } = await admin
          .from('profiles')
          .update(payload)
          .eq('user_id', uid)
          .eq('tenant_id', tenantId);
        if (error) throw error;
        return { crossTenant: false as const };
      }
      const { error } = await admin.from('profiles').insert({
        user_id: uid,
        tenant_id: tenantId,
        ...payload,
      });
      if (error) throw error;
      return { crossTenant: false as const };
    };

    if (mode === 'current') {
      const r = await ensureProfile(callerId, role || 'owner');
      if (r.crossTenant) {
        return NextResponse.json(
          { ok: false, error: 'Current user belongs to another tenant' },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true, updated: 1, mode, skippedCrossTenant: 0 });
    }

    if (mode === 'user') {
      let targetId = userId || '';
      let displayName: string | null = null;
      if (!targetId && email) {
        const found = await findAuthUserByEmail(admin as any, email);
        targetId = found?.id || '';
        displayName = (found?.user_metadata?.name as string) || (found?.email?.split('@')[0] as string) || null;
      }
      if (!targetId)
        return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
      const r = await ensureProfile(targetId, role || 'staff', displayName);
      if (r.crossTenant) {
        return NextResponse.json(
          { ok: false, error: 'User already belongs to another tenant' },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true, updated: 1, mode, skippedCrossTenant: 0 });
    }

    // all-missing: upsert profiles for every auth user missing one, mapping them to caller's tenant as 'staff'
    if (mode === 'all-missing') {
      const users = await listAllAuthUsers(admin as any);
      // Fetch existing profile user_ids to avoid touching mapped users
      const { data: existing } = await admin.from('profiles').select('user_id');
      const have = new Set((existing || []).map((r: any) => String(r.user_id)));
      let count = 0;
      let skippedCrossTenant = 0;
      for (const u of users) {
        if (!u?.id || have.has(String(u.id))) continue;
        const name = (u?.user_metadata?.name as string) || (u?.email?.split('@')[0] as string) || null;
        const r = await ensureProfile(u.id, role || 'staff', name);
        if (r.crossTenant) {
          skippedCrossTenant++;
          continue;
        }
        count++;
      }
      return NextResponse.json({
        ok: true,
        updated: count,
        mode,
        skippedCrossTenant,
      });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported mode' }, { status: 400 });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/ops/backfill-profiles', { id, error: e });
    return NextResponse.json({ ok: false, error: 'Internal error', id }, { status: 500 });
  }
}
