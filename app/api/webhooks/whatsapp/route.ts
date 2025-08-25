import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Verification
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 });
  }
  return new NextResponse('Invalid verification', { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  console.log('WhatsApp webhook', JSON.stringify(body));
  return NextResponse.json({ ok: true });
}

