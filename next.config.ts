import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Reduce dev cache flakiness by using in-memory cache for webpack
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: 'memory' } as any;
    }
    return config;
  },
  // Ensure serverless Chromium and Puppeteer binaries/assets are included in the
  // Vercel Serverless Function bundle. This avoids "Chrome executable not found"
  // at runtime due to file tracing excluding these packages.
  experimental: {
    // Keep these external so Next.js traces and bundles required assets.
    serverComponentsExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core'],
  } as any,
  // Extra safety: explicitly include chromium-min binaries for the PDF route.
  // This helps when dynamic imports prevent static analysis.
  outputFileTracingIncludes: {
    // Match the API route handler for PDF generation
    'app/api/pdf/invoice/route': [
      './node_modules/@sparticuz/chromium-min/bin/**',
      './node_modules/@sparticuz/chromium-min/swiftshader/**',
      './node_modules/@sparticuz/chromium-min/locales/**',
    ],
  },
};

export default nextConfig;
