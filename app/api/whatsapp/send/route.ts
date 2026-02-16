import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { z } from 'zod';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import { can, type Role } from '@/lib/authz';

const BodySchema = z.object({
  to: z.string().min(5),
  templateName: z.string().min(1),
  variables: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  try {
    // Basic rate limit: 10/min per IP (configurable)
    const ip = ipFromHeaders(req.headers);
    const { ok } = takeToken(
      `wa:${ip}`,
      Number(process.env.RATE_LIMIT_WHATSAPP_PER_MIN || 10),
      60_000,
    );
    if (!ok)
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded. Please try later.' },
        { status: 429 },
      );

    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    const { data: authUser, error: authErr } = await sb.auth.getUser();
    const uid = authUser?.user?.id;
    if (authErr || !uid) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    const { data: me } = await sb
      .from('profiles')
      .select('tenant_id, role')
      .eq('user_id', uid)
      .maybeSingle();
    const role = (me as any)?.role as Role | undefined;
    if (!(me as any)?.tenant_id) {
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
      );
    }
    const canSendWhatsApp =
      can(role, 'leads.edit') ||
      can(role, 'invoices.edit') ||
      can(role, 'service.edit') ||
      can(role, 'service.self_edit');
    if (!canSendWhatsApp) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );
    const { to, templateName, variables } = parsed.data;

    // Mock mode: short-circuit and pretend success
    if (
      process.env.NEXT_PUBLIC_E2E_MOCK === '1' ||
      process.env.E2E_MOCK === '1'
    ) {
      return NextResponse.json({ ok: true, id: 'mock-message-id' });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return NextResponse.json(
        { ok: false, error: 'WhatsApp is not configured' },
        { status: 500 },
      );
    }

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: (variables || []).map((v) => ({
                  type: 'text',
                  text: v,
                })),
              },
            ],
          },
        }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'WhatsApp send failed');
    }
    return NextResponse.json({ ok: true, id: data.messages?.[0]?.id });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    console.error('api/whatsapp/send', { id, error: e });
    return NextResponse.json(
      { ok: false, error: 'Internal error', id },
      { status: 500 },
    );
  }
}
