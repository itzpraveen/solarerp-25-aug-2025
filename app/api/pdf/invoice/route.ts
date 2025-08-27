import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Ensure enough time on Vercel

import {
  renderLongInvoiceHtml,
  LongInvoiceData,
} from '@/lib/renderLongInvoiceHtml';
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
    const { ok, remaining } = takeToken(
      `pdf:${ip}`,
      Number(process.env.RATE_LIMIT_PDF_PER_MIN || 5),
      60_000,
    );
    if (!ok)
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded. Please try later.' },
        { status: 429 },
      );

    const sb = supabaseFromAuthHeader(req.headers.get('authorization'));
    // In mock mode, sb will be a mock client even without Authorization
    if (!sb)
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );
    const { tenantId, pathKey, payload } = parsed.data as {
      tenantId: string;
      pathKey?: string;
      payload: LongInvoiceData;
    };
    // Ensure the caller belongs to the same tenantId
    const { data: me } = await sb
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    if (!me || (me as any).tenant_id !== tenantId) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    // Helper: sanitize filename
    const sanitize = (s: string) =>
      String(s || '')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_\-]/g, '_');

    // Short-circuit in mock mode: return a fake signed URL without rendering
    if (
      process.env.NEXT_PUBLIC_E2E_MOCK === '1' ||
      process.env.E2E_MOCK === '1'
    ) {
      const lang = (payload as any)?.lang === 'ml' ? 'ml' : 'en';
      const safeQuote = sanitize((payload as any).meta.quoteNo || 'quote');
      const key = `${tenantId}/${safeQuote}-${lang}.pdf`;
      await sb.storage
        .from('documents')
        .upload(key, new Uint8Array(), {
          contentType: 'application/pdf',
          upsert: true,
        } as any);
      const { data: signed } = await sb.storage
        .from('documents')
        .createSignedUrl(key, 60 * 60 * 24 * 7);
      return NextResponse.json({ ok: true, url: signed?.signedUrl, key });
    }

    const html = renderLongInvoiceHtml(payload);

    // Prefer serverless chromium on Vercel/AWS; fall back to local Chrome in dev
    const isServerless = !!(process.env.AWS_REGION || process.env.VERCEL);
    // Lazy-load heavy deps to keep the bundle of other routes lean
    let chromium: any = null;
    let chromiumMin: null | (() => Promise<any>) = null;
    let puppeteer: any = null;
    try {
      chromium = await import('@sparticuz/chromium').then(
        (m) => m.default || (m as any),
      );
      try {
        (chromium as any).setHeadlessMode = true;
        (chromium as any).setGraphicsMode = false;
        const mlFontUrl = process.env.NEXT_PUBLIC_ML_FONT_URL;
        if (mlFontUrl) {
          try {
            await (chromium as any).font(mlFontUrl);
          } catch (e) {
            console.warn('api/pdf/invoice font-load-failed', { mlFontUrl, e });
          }
        }
      } catch {}
      chromiumMin = async () =>
        await import('@sparticuz/chromium-min').then(
          (m) => m.default || (m as any),
        );
    } catch (e) {
      // Module may be excluded locally; continue with other strategies
      chromium = null;
      chromiumMin = null;
    }
    try {
      puppeteer = await import('puppeteer-core').then(
        (m) => m.default || (m as any),
      );
    } catch {}
    async function resolveExecutablePath() {
      const debug: any = {
        envCandidates: [] as string[],
        localCandidates: [] as string[],
        isServerless,
      };
      // 0) If remote pack URL is provided, use -min to fetch+extract pack on demand (preferred when set)
      try {
        const pack =
          process.env.CHROMIUM_PACK_URL || process.env.CHROMIUM_MIN_PACK_URL;
        if (pack && chromiumMin) {
          const cmin: any = await chromiumMin();
          const p: string | null = await cmin.executablePath(pack);
          if (p) return p;
        }
      } catch {}

      // 1) Otherwise, try @sparticuz/chromium helper (works on Vercel/AWS)
      try {
        if (chromium && chromium.executablePath) {
          const p = await chromium.executablePath();
          if (p) return p;
        }
      } catch {}

      // 2) Prefer explicit env/known paths
      const envCandidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        // Common packaged path on Vercel/AWS when traced into the function
        '/var/task/node_modules/@sparticuz/chromium/bin/chromium',
        // Common custom layer path (AWS Lambda)
        '/opt/chromium',
      ].filter(Boolean) as string[];
      debug.envCandidates = envCandidates;
      for (const p of envCandidates) {
        try {
          if (p && fs.existsSync(p)) return p;
        } catch {}
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
      debug.localCandidates = localCandidates;
      for (const p of localCandidates) {
        try {
          if (fs.existsSync(p)) return p;
        } catch {}
      }

      // 4) Final fallback: try chromium helper again
      try {
        const p = await chromium.executablePath();
        if (p) return p;
      } catch {}
      // Log for debugging on server
      console.error('api/pdf/invoice chrome-resolve-failed', debug);
      return null;
    }

    // Ensure dynamic linker can find Chromium's unpacked libs BEFORE launch
    try {
      const ld = process.env.LD_LIBRARY_PATH || '';
      const extraParts = [
        '/tmp',
        '/tmp/swiftshader',
        // When using chromium-min pack, libs may live here
        '/tmp/chromium-pack',
        '/tmp/chromium-pack/lib',
        '/tmp/chromium-pack/swiftshader',
        // Common AWS Lambda layer paths
        '/opt/chromium',
        '/opt/chromium/lib',
        '/opt/chromium/swiftshader',
        // Vercel: bundled libs inside node_modules
        '/var/task/node_modules/@sparticuz/chromium/lib',
        '/var/task/node_modules/@sparticuz/chromium/swiftshader',
      ];
      const extra = Array.from(new Set(extraParts.filter(Boolean))).join(':');
      process.env.LD_LIBRARY_PATH = ld ? `${extra}:${ld}` : extra;
      // Helpful defaults for font/config caches in ephemeral fs
      if (!process.env.XDG_CACHE_HOME) process.env.XDG_CACHE_HOME = '/tmp';
      if (!process.env.FONTCONFIG_PATH) process.env.FONTCONFIG_PATH = '/tmp';
    } catch {}

    const executablePath = await resolveExecutablePath();
    try {
      console.log('api/pdf/invoice execPath', executablePath);
      // Surface whether expected lib paths exist at runtime
      const checks = [
        '/tmp/libnss3.so',
        '/tmp/chromium-pack/libnss3.so',
        '/tmp/chromium-pack/aws/libnss3.so',
        '/tmp/chromium-pack/lib/libnss3.so',
        '/opt/chromium/libnss3.so',
        '/opt/chromium/lib/libnss3.so',
      ];
      console.log(
        'api/pdf/invoice lib checks',
        Object.fromEntries(checks.map((p) => [p, fs.existsSync(p)])),
      );
    } catch {}
    try {
      process.env.CHROME_PATH = executablePath || process.env.CHROME_PATH || '';
      process.env.PUPPETEER_EXECUTABLE_PATH =
        executablePath || process.env.PUPPETEER_EXECUTABLE_PATH || '';
    } catch {}
    if (!executablePath) {
      const id = Math.random().toString(36).slice(2, 10);
      console.error('api/pdf/invoice chrome-missing', { id });
      return NextResponse.json(
        {
          ok: false,
          error: 'Chrome/Chromium executable not found',
          id,
          hint: 'Install Google Chrome locally or set PUPPETEER_EXECUTABLE_PATH/CHROME_PATH. On Vercel, ensure @sparticuz/chromium is bundled and optionally set PUPPETEER_EXECUTABLE_PATH=/var/task/node_modules/@sparticuz/chromium/bin/chromium. For dev without Chrome, set NEXT_PUBLIC_E2E_MOCK=1.',
        },
        { status: 500 },
      );
    }

    // Use chromium args universally for broader compatibility; local Chrome ignores unknown flags
    // Prefer chromium's defaults for serverless envs
    const launchEnv = {
      ...process.env,
      LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
    };
    const pptr = puppeteer;
    if (!pptr) {
      const id = Math.random().toString(36).slice(2, 10);
      return NextResponse.json(
        {
          ok: false,
          error: 'Puppeteer not available',
          id,
          hint: 'Ensure puppeteer-core or puppeteer is installed',
        },
        { status: 500 },
      );
    }
    const browser = await pptr.launch({
      args: (chromium && chromium.args) || [],
      defaultViewport: (chromium && chromium.defaultViewport) ?? null,
      executablePath: executablePath || undefined,
      headless: (chromium && chromium.headless) ?? 'new',
      dumpio: true,
      userDataDir: '/tmp/chrome-user-data',
      env: launchEnv,
    });
    const page = await browser.newPage();
    // Safer content load strategy on serverless: avoid hangs on external assets
    page.setDefaultNavigationTimeout(25_000);
    try {
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const rt = req.resourceType();
        // Allow data: and inline requests; block external fonts/images if any
        const url = req.url();
        if (url.startsWith('data:')) return req.continue();
        if (rt === 'image' || rt === 'media') return req.abort();
        return req.continue();
      });
    } catch {}
    await page.goto(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      { waitUntil: 'networkidle0', timeout: 20_000 },
    );
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
      console.error('api/pdf/invoice upload-failed', {
        id,
        tenantId,
        key,
        error,
      });
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
