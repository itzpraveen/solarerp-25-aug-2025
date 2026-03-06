import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';
import { getCurrentProfile } from '@/lib/currentProfile';
import { isServerMockMode } from '@/lib/mockMode';
import {
  canManageRequestedRole,
  canManageTargetRole,
  isAdminishRole,
} from '@/lib/teamPermissions';

const BodySchema = z.object({
  userId: z.string().min(1),
  role: z.enum([
    'owner',
    'admin',
    'manager',
    'sales',
    'technician',
    'accountant',
    'viewer',
    'staff',
  ]),
});

export async function POST(req: NextRequest) {
  try {
    const ip = ipFromHeaders(req.headers);
    const { ok } = takeToken(`team:role:${ip}`, 60, 60_000);
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
    const { userId, role } = parsed.data;

    const isMock = isServerMockMode();
    const { userId: uid, profile: me } = await getCurrentProfile<{
      user_id: string;
      tenant_id: string;
      role: string;
    }>(sb as any, 'user_id, tenant_id, role');
    if (!uid && !isMock)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    if (!isMock) {
      if (!me?.tenant_id || !isAdminishRole((me as any).role))
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403 },
        );
    }
    const tenantId = ((me as any)?.tenant_id as string) || 't1';

    const { data: targetProfile } = await sb
      .from('profiles')
      .select('user_id, role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 },
      );
    }

    if (
      !isMock &&
      (!canManageRequestedRole((me as any).role, role) ||
        !canManageTargetRole((me as any).role, (targetProfile as any).role))
    ) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    if ((targetProfile as any).role === 'owner' && role !== 'owner') {
      const { data: owners } = await sb
        .from('profiles')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner');
      if ((owners || []).length <= 1) {
        return NextResponse.json(
          { ok: false, error: 'Cannot demote the last owner' },
          { status: 400 },
        );
      }
    }

    // Prevent removing last owner
    // Enforce at least one admin-ish (owner/admin) remains
    const { data: admins } = await sb
      .from('profiles')
      .select('user_id, role')
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin'] as any);
    const isTargetAdminish = !!(admins || []).find(
      (o: any) => o.user_id === userId,
    );
    const adminishCount = (admins || []).length;
    if (
      isTargetAdminish &&
      !['owner', 'admin'].includes(role) &&
      adminishCount <= 1
    ) {
      return NextResponse.json(
        { ok: false, error: 'Cannot demote the last admin' },
        { status: 400 },
      );
    }
    // Optional: prevent self-demotion if last owner
    if (
      !isMock &&
      (me as any).user_id === userId &&
      !['owner', 'admin'].includes(role) &&
      adminishCount <= 1
    ) {
      return NextResponse.json(
        { ok: false, error: 'Add another admin before demoting yourself' },
        { status: 400 },
      );
    }

    const { error } = await sb
      .from('profiles')
      .update({ role })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);
    if (error) {
      const id = Math.random().toString(36).slice(2, 10);
      console.error('api/team/role db', { id, error });
      return NextResponse.json(
        { ok: false, error: 'Internal error', id },
        { status: 500 },
      );
    }
    // Audit
    await logAudit(sb as any, {
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
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
