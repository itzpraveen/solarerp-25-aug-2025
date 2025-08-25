import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    // Require authenticated caller; derive user from token
    const sb = await supabaseFromAuthHeader();
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { data: authUser, error: uErr } = await sb.auth.getUser();
    if (uErr || !authUser?.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const user = { id: authUser.user.id, email: authUser.user.email };
    const admin = supabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (profile) return NextResponse.json({ ok: true, tenantId: profile.tenant_id });

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ name: user.email || 'My Company' })
      .select('id')
      .single();
    await admin.from('profiles').insert({ user_id: user.id, tenant_id: tenant!.id, role: 'owner' });
    await admin.from('settings').insert({ tenant_id: tenant!.id, currency: 'INR', primary_discom: 'KSEB', default_tax_rate: 0 });
    return NextResponse.json({ ok: true, tenantId: tenant!.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
