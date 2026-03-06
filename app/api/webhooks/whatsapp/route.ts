import { NextRequest, NextResponse } from 'next/server';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { secureEqual } from '@/lib/secureCompare';

function verifyMetaSignature(rawBody: string, header: string | null) {
  const appSecret = env.whatsappAppSecret;
  if (!appSecret) {
    return process.env.NODE_ENV !== 'production';
  }
  const provided = String(header || '').replace(/^sha256=/, '').trim();
  if (!provided) return false;
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  return secureEqual(provided, expected);
}

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
  if (!ok)
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded' },
      { status: 429 },
    );
  const rawBody = await req.text();
  if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json(
      { ok: false, error: 'Invalid signature' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON payload' },
      { status: 400 },
    );
  }
  const entries = Array.isArray(body?.entry) ? body.entry.length : 0;
  console.log('WhatsApp webhook received', { entries });
  return NextResponse.json({ ok: true });
}
