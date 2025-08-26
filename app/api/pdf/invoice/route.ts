import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Ensure enough time on Vercel

import { renderLongInvoiceHtml, LongInvoiceData } from '@/lib/renderLongInvoiceHtml';
import { supabaseFromAuthHeader } from '@/lib/supabaseServer';
import { takeToken, ipFromHeaders } from '@/lib/rateLimit';
import fs from 'node:fs';
import { z } from 'zod';

const BodySchema = z.object({
  tenantId: z.string().min(1),
  pathKey: z.string().optional(),
  payload: z.any(),
});

export async function POST(req: NextRequest) {
  try {
    // Basic rate limit: 5/min per IP (configurable). Best-effort, single-instance only.
    const ip = ipFromHeaders(req.headers);
    const { ok, remaining } = takeToken(`pdf:${ip}`, Number(process.env.RATE_LIMIT_PDF_PER_MIN || 5), 60_000);
    if (!ok) return NextResponse.json({ ok: false, error: 'Rate limit exceeded. Please try later.' }, { status: 429 });

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

    // Helper: sanitize filename
    const sanitize = (s: string) =>
      String(s || '')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_\-]/g, '_');

    // Short-circuit in mock mode: return a fake signed URL without rendering
    if (process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1') {
      const lang = (payload as any)?.lang === 'ml' ? 'ml' : 'en';
      const safeQuote = sanitize((payload as any).meta.quoteNo || 'quote');
      const key = `${tenantId}/${safeQuote}-${lang}.pdf`;
      await sb.storage.from('documents').upload(key, new Uint8Array(), { contentType: 'application/pdf', upsert: true } as any);
      const { data: signed } = await sb.storage.from('documents').createSignedUrl(key, 60 * 60 * 24 * 7);
      return NextResponse.json({ ok: true, url: signed?.signedUrl, key });
    }

    const html = renderLongInvoiceHtml(payload);

    // Prefer serverless chromium on Vercel/AWS; fall back to local Chrome in dev
    const isServerless = !!(process.env.AWS_REGION || process.env.VERCEL);
    // Lazy-load heavy deps to keep the bundle of other routes lean
    const chromium = await import('@sparticuz/chromium').then(m => m.default || (m as any));
    const puppeteer = await import('puppeteer-core').then(m => m.default || (m as any));
    async function resolveExecutablePath() {
      // 1) Always prefer explicit env paths if present (both prod and dev)
      const envCandidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        // Common packaged path on Vercel/AWS when traced into the function
        '/var/task/node_modules/@sparticuz/chromium/bin/chromium',
        // Common custom layer path (AWS Lambda)
        '/opt/chromium',
      ].filter(Boolean) as string[];
      for (const p of envCandidates) {
        try { if (p && fs.existsSync(p)) return p; } catch {}
      }

      // 2) Serverless helper path from @sparticuz/chromium (Vercel/AWS)
      if (isServerless) {
        try { const p = await chromium.executablePath(); if (p) return p; } catch {}
      }

      // 3) Try common local Chrome/Chromium paths (dev workstations)
      const localCandidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/opt/google/chrome/chrome',
      ];
      for (const p of localCandidates) {
        try { if (fs.existsSync(p)) return p; } catch {}
      }

      // 4) Final fallback: try chromium helper even on dev
      try { const p = await chromium.executablePath(); if (p) return p; } catch {}
      return null;
    }

    const executablePath = await resolveExecutablePath();
    if (!executablePath) {
      const id = Math.random().toString(36).slice(2, 10);
      console.error('api/pdf/invoice chrome-missing', { id, candidatesTried: true });
      return NextResponse.json(
        {
          ok: false,
          error: 'Chrome/Chromium executable not found',
          id,
          hint:
            'Install Google Chrome or set CHROME_PATH/PUPPETEER_EXECUTABLE_PATH. For dev without Chrome, set NEXT_PUBLIC_E2E_MOCK=1 to bypass rendering.',
        },
        { status: 500 },
      );
    }

    // Use chromium args universally for broader compatibility; local Chrome ignores unknown flags
    // Prefer chromium's defaults for serverless envs
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport ?? null,
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    // Safer content load strategy on serverless: avoid hanging on external resources
    page.setDefaultNavigationTimeout(20_000);
    await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });
    await page.emulateMediaType('screen');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '12mm', right: '12mm' },
    });
    await browser.close();

    // Sanitize object key and suffix by language to keep EN/ML separate
    const lang = (payload as any)?.lang === 'ml' ? 'ml' : 'en';
    const safeQuote = sanitize((payload as any).meta.quoteNo || 'quote');
    const key = `${tenantId}/${safeQuote}-${lang}.pdf`;

    const { error } = await sb.storage.from('documents').upload(key, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) {
      const id = Math.random().toString(36).slice(2, 10);
      console.error('api/pdf/invoice upload-failed', { id, tenantId, key, error });
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to upload PDF to storage',
          id,
          hint: "Ensure Supabase bucket 'documents' exists and your storage policies allow writes to '<tenant_id>/*'",
        },
        { status: 500 },
      );
    }

    const { data: signed } = await sb.storage
      .from('documents')
      .createSignedUrl(key, 60 * 60 * 24 * 7); // 7 days

    return NextResponse.json({ ok: true, url: signed?.signedUrl, key });
  } catch (e: any) {
    const id = Math.random().toString(36).slice(2, 10);
    const msg = typeof e?.message === 'string' ? e.message : String(e);
    console.error('api/pdf/invoice', { id, error: e });
    // Provide a more descriptive error for easier debugging in UI
    return NextResponse.json(
      {
        ok: false,
        error: 'PDF generation failed',
        id,
        cause: msg.slice(0, 500),
      },
      { status: 500 },
    );
  }
}
