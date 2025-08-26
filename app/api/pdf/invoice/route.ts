import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { renderLongInvoiceHtml, LongInvoiceData } from '@/lib/renderLongInvoiceHtml';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { z } from 'zod';

const BodySchema = z.object({
  tenantId: z.string().min(1),
  pathKey: z.string().optional(),
  payload: z.any(),
});

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    // In mock mode, sb will be a mock client even without Authorization
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { tenantId, pathKey, payload } = parsed.data as { tenantId: string; pathKey?: string; payload: LongInvoiceData };
    // Ensure the caller belongs to the same tenantId
    const { data: me } = await sb.from('profiles').select('tenant_id').maybeSingle();
    if (!me || (me as any).tenant_id !== tenantId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Short-circuit in mock mode: return a fake signed URL without rendering
    if (process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1') {
      const safeQuote = String((payload as any).meta.quoteNo || '')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_\-]/g, '_');
      const key = pathKey || `${tenantId}/${safeQuote}.pdf`;
      await sb.storage.from('documents').upload(key, new Uint8Array(), { contentType: 'application/pdf', upsert: true } as any);
      const { data: signed } = await sb.storage.from('documents').createSignedUrl(key, 60 * 60 * 24 * 7);
      return NextResponse.json({ ok: true, url: signed?.signedUrl, key });
    }

    const html = renderLongInvoiceHtml(payload);

    // Prefer serverless chromium on Vercel/AWS; fall back to local Chrome in dev
    const isServerless = !!(process.env.AWS_REGION || process.env.VERCEL);
    async function resolveExecutablePath() {
      if (isServerless) {
        return chromium.executablePath();
      }
      const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/opt/google/chrome/chrome',
      ].filter(Boolean) as string[];
      for (const p of candidates) {
        try { if (p && fs.existsSync(p)) return p; } catch {}
      }
      try { return await chromium.executablePath(); } catch {}
      return null;
    }

    const executablePath = await resolveExecutablePath();
    if (!executablePath) {
      return NextResponse.json({ ok: false, error: 'Chromium/Chrome not found. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH to a local Chrome binary.' }, { status: 500 });
    }

    const browser = await puppeteer.launch({
      args: isServerless ? chromium.args : [],
      defaultViewport: isServerless ? chromium.defaultViewport : null,
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '12mm', right: '12mm' },
    });
    await browser.close();

    // Sanitize object key to avoid slashes/special chars
    const safeQuote = String((payload as any).meta.quoteNo || '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_\-]/g, '_');
    const key = pathKey || `${tenantId}/${safeQuote}.pdf`;

    const { error } = await sb.storage.from('documents').upload(key, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) throw error;

    const { data: signed } = await sb.storage
      .from('documents')
      .createSignedUrl(key, 60 * 60 * 24 * 7); // 7 days

    return NextResponse.json({ ok: true, url: signed?.signedUrl, key });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
