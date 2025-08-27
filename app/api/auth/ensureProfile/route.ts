import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const ip = ipFromHeaders(req.headers);
    const { ok } = takeToken(`ensureProfile:${ip}`, 20, 60_000); // 20/min per IP
    if (!ok)
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded' },
        { status: 429 },
      );
    // Require authenticated caller; derive user from token
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    const { data: authUser, error: uErr } = await sb.auth.getUser();
    if (uErr || !authUser?.user)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    const user = { id: authUser.user.id, email: authUser.user.email };
    const admin = supabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile)
      return NextResponse.json({ ok: true, tenantId: profile.tenant_id });
    // If self-signups are disabled, block auto-provision and require invite
    const allowSelf = process.env.ALLOW_SELF_SIGNUP === '1';
    if (!allowSelf) {
      return NextResponse.json(
        { ok: false, error: 'Invite required' },
        { status: 403 },
      );
    }
    const { data: tenant } = await admin
      .from('tenants')
      .insert({ name: user.email || 'My Company' })
      .select('id')
      .single();
    await admin
      .from('profiles')
      .insert({ user_id: user.id, tenant_id: tenant!.id, role: 'owner' });
    await admin
      .from('settings')
      .insert({
        tenant_id: tenant!.id,
        currency: 'INR',
        primary_discom: 'KSEB',
        default_tax_rate: 0,
      });
    // Audit best-effort (can't use admin client with RLS, but this route is trusted server code)
    try {
      await admin.from('audit_logs').insert({
        tenant_id: tenant!.id,
        user_id: user.id,
        action: 'auth.ensure_profile',
        entity: 'tenants',
        entity_id: tenant!.id,
        metadata: { email: user.email },
      });
    } catch {}
    return NextResponse.json({ ok: true, tenantId: tenant!.id });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/auth/ensureProfile', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
