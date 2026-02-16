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
import { getBaseUrl } from '@/lib/baseUrl';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BodySchema = z.object({
  payload: z.any(),
});

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const debugMode =
      process.env.PDF_DEBUG_VERBOSE === '1' || url.searchParams.get('debug') === '1';
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
    if (!sb) {
      return NextResponse.json(
        debugMode
          ? { ok: false, error: 'Unauthorized', hint: 'Missing Authorization bearer token' }
          : { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: 'Invalid payload' },
        { status: 400 },
      );
    const { data: authUser, error: authErr } = await sb.auth.getUser();
    const uid = authUser?.user?.id;
    if (authErr || !uid) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { payload } = parsed.data as {
      payload: LongInvoiceData;
    };
    // Resolve caller's tenantId authoritatively from profile.
    const { data: me } = await sb
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', uid)
      .maybeSingle();
    const tenantId = (me as any)?.tenant_id as string | undefined;
    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: 'Profile not ready' },
        { status: 400 },
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
      await sb.storage.from('documents').upload(key, new Uint8Array(), {
        contentType: 'application/pdf',
        upsert: true,
      } as any);
      const { data: signed } = await sb.storage
        .from('documents')
        .createSignedUrl(key, 60 * 60 * 24 * 7);
      return NextResponse.json({ ok: true, url: signed?.signedUrl, key });
    }

    function isPrivateIpv4(hostname: string) {
      const parts = hostname.split('.').map((p) => Number(p));
      if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) {
        return false;
      }
      const [a, b] = parts;
      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      return false;
    }

    function isSafePublicHttpUrl(raw: string) {
      try {
        const u = new URL(raw);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
        const host = u.hostname.toLowerCase();
        if (!host || host === 'localhost' || host.endsWith('.local')) {
          return false;
        }
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
          if (isPrivateIpv4(host)) return false;
        }
        // Block direct IPv6 host literals to avoid private-network fetches.
        if (host.includes(':')) return false;
        return true;
      } catch {
        return false;
      }
    }

    // Prefetch external logo and embed as data URL so images are not blocked.
    async function toDataUrl(url: string, fallbackMime?: string): Promise<string | null> {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(url, {
          cache: 'no-store',
          // Some CDNs require a UA; keep it minimal
          headers: { Accept: 'image/*;q=0.9,*/*;q=0.1' },
          signal: ctrl.signal,
        } as any);
        clearTimeout(t);
        if (!res.ok) return null;
        const len = Number(res.headers.get('content-length') || 0);
        if (Number.isFinite(len) && len > 2 * 1024 * 1024) return null;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 2 * 1024 * 1024) return null;
        const mime =
          res.headers.get('content-type') ||
          fallbackMime ||
          (url.endsWith('.svg') || url.endsWith('.svgz')
            ? 'image/svg+xml'
            : url.endsWith('.png')
              ? 'image/png'
              : url.endsWith('.jpg') || url.endsWith('.jpeg')
                ? 'image/jpeg'
                : 'application/octet-stream');
        const b64 = Buffer.from(buf).toString('base64');
        return `data:${mime};base64,${b64}`;
      } catch {
        return null;
      }
    }

    let preparedPayload: LongInvoiceData = payload as any;
    try {
      const logo = (payload as any)?.company?.logoUrl as string | undefined;
      if (logo && !logo.startsWith('data:') && isSafePublicHttpUrl(logo)) {
        const dataUrl = await toDataUrl(logo);
        if (dataUrl)
          preparedPayload = {
            ...(payload as any),
            company: { ...(payload as any).company, logoUrl: dataUrl },
          } as any;
      }
    } catch {}

    const html = renderLongInvoiceHtml(preparedPayload);

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
        const mlFontUrl =
          process.env.NEXT_PUBLIC_ML_FONT_URL ||
          `${getBaseUrl()}/fonts/NotoSansMalayalam-Regular.ttf`;
        if (mlFontUrl) {
          try {
            await (chromium as any).font(mlFontUrl);
          } catch (e) {
            if (process.env.LOG_PDF_DEBUG === '1')
              console.warn('api/pdf/invoice font-load-failed', {
                mlFontUrl,
                e,
              });
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
          process.env.CHROMIUM_MIN_PACK_URL || process.env.CHROMIUM_PACK_URL;
        if (pack && chromiumMin) {
          const cmin: any = await chromiumMin();
          const p: string | null = await cmin.executablePath(pack);
          if (p) return p;
        }
      } catch {}

      // 1) Prefer explicit env/known paths first (keeps libs colocated in node_modules on Vercel)
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

      // 2) Try @sparticuz/chromium helper (works on Vercel/AWS)
      try {
        if (chromium && chromium.executablePath) {
          const p = await chromium.executablePath();
          if (p) return p;
        }
      } catch {}

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
      if (process.env.LOG_PDF_DEBUG === '1')
        console.error('api/pdf/invoice chrome-resolve-failed', debug);
      return null;
    }

    // Ensure dynamic linker can find Chromium's unpacked libs BEFORE launch
    try {
      const ld = process.env.LD_LIBRARY_PATH || '';
      const extraParts = [
        // Paths where @sparticuz/chromium inflates assets on serverless platforms
        '/tmp',
        '/tmp/swiftshader',
        // Newer @sparticuz/chromium (v127+) inflates platform libs here
        '/tmp/al2/lib',
        '/tmp/al2023/lib',
        // When using chromium-min pack, libs may live here
        '/tmp/chromium-pack',
        '/tmp/chromium-pack/lib',
        '/tmp/chromium-pack/swiftshader',
        // Common AWS Lambda layer paths
        '/opt/chromium',
        '/opt/chromium/lib',
        '/opt/chromium/swiftshader',
        // Vercel: bundled libs inside node_modules (older packaging)
        '/var/task/node_modules/@sparticuz/chromium/lib',
        '/var/task/node_modules/@sparticuz/chromium/swiftshader',
      ];
      const extra = Array.from(new Set(extraParts.filter(Boolean))).join(':');
      process.env.LD_LIBRARY_PATH = ld ? `${extra}:${ld}` : extra;
      // Helpful defaults for font/config caches in ephemeral fs
      if (!process.env.XDG_CACHE_HOME) process.env.XDG_CACHE_HOME = '/tmp';
      // @sparticuz/chromium inflates fonts + fontconfig to /tmp/fonts
      if (!process.env.FONTCONFIG_PATH)
        process.env.FONTCONFIG_PATH = '/tmp/fonts';
      if (!process.env.HOME) process.env.HOME = '/tmp';
    } catch {}

    // If running in environments that don't set AWS_* markers but need NSS libs,
    // forcibly inflate the platform libs from @sparticuz/chromium's bin folder.
    try {
      const nodeMajor = Number(
        String(process.versions.node || '20').split('.')[0],
      );
      const preferred = nodeMajor >= 20 ? 'al2023.tar.br' : 'al2.tar.br';
      const binBases = [
        '/var/task/node_modules/@sparticuz/chromium/bin',
        path.join(
          process.cwd(),
          'node_modules',
          '@sparticuz',
          'chromium',
          'bin',
        ),
      ];
      const tarCandidates = [
        preferred,
        preferred === 'al2023.tar.br' ? 'al2.tar.br' : 'al2023.tar.br',
      ];
      let inflatedAny = false;
      const lambdafsCandidates = [
        path.join(
          process.cwd(),
          'node_modules',
          '@sparticuz',
          'chromium',
          'build',
          'esm',
          'lambdafs.js',
        ),
        path.join(
          process.cwd(),
          'node_modules',
          '@sparticuz',
          'chromium',
          'build',
          'cjs',
          'lambdafs.cjs',
        ),
      ];
      let LambdaFS: any = null;
      for (const candidate of lambdafsCandidates) {
        if (!fs.existsSync(candidate)) continue;
        try {
          const mod: any = await import(pathToFileURL(candidate).href);
          LambdaFS = (mod && (mod.default || mod)) as any;
          break;
        } catch (e) {
          if (process.env.LOG_PDF_DEBUG === '1')
            console.warn('api/pdf/invoice lambdafs-load-failed', {
              candidate,
              e,
            });
        }
      }
      for (const base of binBases) {
        for (const tarName of tarCandidates) {
          const p = path.join(base, tarName);
          if (!fs.existsSync(p) || !LambdaFS?.inflate) continue;
          try {
            await LambdaFS.inflate(p);
            inflatedAny = true;
          } catch (e) {
            if (process.env.LOG_PDF_DEBUG === '1')
              console.warn('api/pdf/invoice inflate-lib-failed', { p, e });
          }
        }
      }
      if (process.env.LOG_PDF_DEBUG === '1')
        console.log('api/pdf/invoice inflate-libs', {
          inflatedAny,
          preferred,
          nodeMajor,
        });
    } catch {}

    const executablePath = await resolveExecutablePath();
    try {
      if (process.env.LOG_PDF_DEBUG === '1') {
        console.log('api/pdf/invoice execPath', executablePath);
        console.log(
          'api/pdf/invoice LD_LIBRARY_PATH',
          process.env.LD_LIBRARY_PATH,
        );
        // Surface whether expected lib paths exist at runtime
        const checks = [
          // Newer @sparticuz/chromium inflates NSS libs here
          '/tmp/al2/lib/libnss3.so',
          '/tmp/al2023/lib/libnss3.so',
          // Legacy/custom pack locations
          '/tmp/libnss3.so',
          '/tmp/chromium-pack/libnss3.so',
          '/tmp/chromium-pack/aws/libnss3.so',
          '/tmp/chromium-pack/lib/libnss3.so',
          '/opt/chromium/libnss3.so',
          '/opt/chromium/lib/libnss3.so',
          '/var/task/node_modules/@sparticuz/chromium/lib/libnss3.so',
        ];
        console.log(
          'api/pdf/invoice lib checks',
          Object.fromEntries(checks.map((p) => [p, fs.existsSync(p)])),
        );
      }
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
        debugMode
          ? {
              ok: false,
              error: 'Failed to upload PDF to storage',
              id,
              tenantId,
              key,
              storageError: (error as any)?.message || String(error),
              hint:
                "Ensure Supabase bucket 'documents' exists and storage RLS allows writes to '<tenant_id>/*'.",
            }
          : {
              ok: false,
              error: 'Failed to upload PDF to storage',
              id,
              hint:
                "Ensure Supabase bucket 'documents' exists and your storage policies allow writes to '<tenant_id>/*'",
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
      process.env.PDF_DEBUG_VERBOSE === '1'
        ? {
            ok: false,
            error: 'PDF generation failed',
            id,
            cause: msg.slice(0, 500),
          }
        : {
            ok: false,
            error: 'PDF generation failed',
            id,
          },
      { status: 500 },
    );
  }
}
