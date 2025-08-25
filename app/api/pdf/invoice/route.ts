import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { renderLongInvoiceHtml, LongInvoiceData } from '@/lib/renderLongInvoiceHtml';
import { createClient } from '@supabase/supabase-js';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-side only
    );
    const body = (await req.json()) as { tenantId: string; pathKey?: string; payload: LongInvoiceData };
    const html = renderLongInvoiceHtml(body.payload);

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

    const key = body.pathKey || `${body.tenantId}/${body.payload.meta.quoteNo.replace(/\s+/g, '_')}.pdf`;

    const { error } = await supabaseAdmin.storage.from('documents').upload(key, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) throw error;

    const { data: signed } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(key, 60 * 60 * 24 * 7); // 7 days

    return NextResponse.json({ ok: true, url: signed?.signedUrl, key });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
