import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { selectMyProfile } from '@/lib/currentProfile';

const Body = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(), // null/undefined to unassign
});

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );
    const { taskId, userId } = parsed.data;

    // Caller must be owner/admin/manager to assign; technicians may self-assign
    const { userId: callerId, profile: me } = await selectMyProfile(
      sb as any,
      'user_id, tenant_id, role',
    );
    const tenantId = (me as any)?.tenant_id as string | undefined;
    const role = (me as any)?.role as string | undefined;
    if (!tenantId)
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
      );

    const canManage = ['owner', 'admin', 'manager'].includes(role || '');

    // Load task to verify tenant and current assignment
    const { data: t } = await sb
      .from('tasks')
      .select('id, tenant_id, assigned_to')
      .eq('id', taskId)
      .maybeSingle();
    if (!t || (t as any).tenant_id !== tenantId)
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404 },
      );

    if (!canManage) {
      // Allow technician self-assign or self-unassign only
      const currentAssignee = (t as any)?.assigned_to as string | null;
      if (!callerId)
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403 },
        );
      if (userId && userId !== callerId)
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403 },
        );
      if (userId === callerId && currentAssignee && currentAssignee !== callerId)
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403 },
        );
      if (!userId && currentAssignee && currentAssignee !== callerId)
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403 },
        );
    }

    let targetUserId: string | null = userId ?? null;
    if (targetUserId) {
      // Verify target profile is in same tenant
      const { data: target } = await sb
        .from('profiles')
        .select('user_id')
        .eq('user_id', targetUserId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!target)
        return NextResponse.json(
          { ok: false, error: 'User not in tenant' },
          { status: 400 },
        );
    }

    const { error } = await sb
      .from('tasks')
      .update({ assigned_to: targetUserId })
      .eq('id', taskId);
    if (error)
      return NextResponse.json(
        { ok: false, error: 'Update failed' },
        { status: 500 },
      );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/tasks/assign', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
