import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { renderLongInvoiceHtml, LongInvoiceData } from '@/lib/renderLongInvoiceHtml';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { z } from 'zod';

const BodySchema = z.object({
  tenantId: z.string().min(1),
  pathKey: z.string().optional(),
  payload: z.any(),
});

export async function POST(req: NextRequest) {
  try {
    const sb = await supabaseFromAuthHeader();
    if (!sb) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const { tenantId, pathKey, payload } = parsed.data as { tenantId: string; pathKey?: string; payload: LongInvoiceData };
    // Ensure the caller belongs to the same tenantId
    const { data: me } = await sb.from('profiles').select('tenant_id').single();
    if (!me || (me as any).tenant_id !== tenantId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const html = renderLongInvoiceHtml(payload);

    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
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

    const key = pathKey || `${tenantId}/${(payload as any).meta.quoteNo.replace(/\s+/g, '_')}.pdf`;

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
