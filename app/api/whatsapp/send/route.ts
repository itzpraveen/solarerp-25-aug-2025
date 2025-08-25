import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { to, templateName, variables } = (await req.json()) as {
      to: string;
      templateName: 'proposal_ready' | 'invoice_due' | string;
      variables: string[];
    };

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

