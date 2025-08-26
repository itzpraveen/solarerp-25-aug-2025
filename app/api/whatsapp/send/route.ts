import { NextRequest, NextResponse } from 'next/server';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { z } from 'zod';

const BodySchema = z.object({
  to: z.string().min(5),
  templateName: z.string().min(1),
  variables: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { to, templateName, variables } = parsed.data;

    // Mock mode: short-circuit and pretend success
    if (process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1') {
      return NextResponse.json({ ok: true, id: 'mock-message-id' });
    }

    const token = process.env.WHATSAPP_TOKEN!;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
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
              parameters: (variables || []).map((v) => ({ type: 'text', text: v })),
            },
          ],
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'WhatsApp send failed');
    }
    return NextResponse.json({ ok: true, id: data.messages?.[0]?.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
