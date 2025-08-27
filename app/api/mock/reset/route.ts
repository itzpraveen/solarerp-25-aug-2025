import { NextResponse } from 'next/server';
import { resetDb } from '@/lib/supabaseMock';

export async function POST() {
  if (
    !(process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1')
  ) {
    return NextResponse.json(
      { ok: false, error: 'Not available' },
      { status: 404 },
    );
  }
  resetDb();
  return NextResponse.json({ ok: true });
}
