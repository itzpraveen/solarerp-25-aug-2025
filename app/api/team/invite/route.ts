import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { env } from '@/lib/env';
import { getCurrentProfile } from '@/lib/currentProfile';
import {
  canManageRequestedRole,
  canManageTargetRole,
} from '@/lib/teamPermissions';
import {
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from '@/lib/authUsername';

const BodySchema = z.object({
  username: z.string().min(3).max(32),
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
  password: z.string().min(6).max(128).optional(),
});

const AUTH_USERS_PER_PAGE = 1000;
const AUTH_USERS_MAX_PAGES = 20;

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
    const username = normalizeUsername(parsed.data.username);
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid username format' },
        { status: 400 },
      );
    }
    const { role } = parsed.data;
    const email = usernameToEmail(
      username,
      env.authUsernameDomain || 'erp.renewg.in',
    );
    const password = parsed.data.password || env.defaultUserPassword;
    if (!password) {
      return NextResponse.json(
        { ok: false, error: 'Default password not configured' },
        { status: 500 },
      );
    }

    const { userId: uid, profile: me } = await getCurrentProfile<{
      tenant_id: string;
      role: string;
    }>(sb as any, 'tenant_id, role');
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
    if (!canManageRequestedRole((me as any).role, role))
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );

    const tenantId = (me as any).tenant_id as string;

    // Real environment: create the user and upsert profile
    const admin = supabaseAdmin();
    // Try create; if it fails due to existing, scan users and match by email.
    let userId: string | null = null;
    try {
      const { data: created, error: createErr } =
        await (admin as any).auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created?.user?.id || null;
    } catch (_) {
      userId = null;
    }

    if (!userId) {
      try {
        const found = await findAuthUserByEmail(admin as any, email);
        userId = found?.id || null;
      } catch (_) {}
    }

    if (!userId)
      return NextResponse.json(
        { ok: false, error: 'Unable to create user' },
        { status: 500 },
      );

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .maybeSingle();
    const existingTenantId = (existingProfile as any)?.tenant_id as
      | string
      | undefined;
    if (existingTenantId && existingTenantId !== tenantId) {
      return NextResponse.json(
        { ok: false, error: 'User already belongs to another tenant' },
        { status: 409 },
      );
    }
    if (
      existingTenantId === tenantId &&
      !canManageTargetRole((me as any).role, (existingProfile as any)?.role)
    ) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    const profilePatch = {
      role,
      display_name: username,
      username,
    };
    const { error: profileErr } = existingTenantId
      ? await admin
          .from('profiles')
          .update(profilePatch)
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
      : await admin.from('profiles').insert({
          user_id: userId,
          tenant_id: tenantId,
          ...profilePatch,
        });
    if (profileErr)
      return NextResponse.json(
        { ok: false, error: 'Profile update failed' },
        { status: 500 },
      );

    // Best-effort audit
    await logAudit(sb as any, {
      tenantId,
      userId: uid,
      action: 'team.invite',
      entity: 'profiles',
      entityId: userId,
      metadata: { username, role },
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
