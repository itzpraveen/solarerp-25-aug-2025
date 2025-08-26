import { NextRequest, NextResponse } from 'next/server';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';

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
  // Light protection to avoid abuse; do not block Meta calls if you expect bursts
  const ip = ipFromHeaders(req.headers);
  const { ok } = takeToken(`wa-webhook:${ip}`, 60, 60_000); // 60/min per IP
  if (!ok) return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  console.log('WhatsApp webhook', JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
