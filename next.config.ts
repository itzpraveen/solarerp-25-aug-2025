import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },

  // Enable React Compiler for automatic memoization (React 19+)
  reactCompiler: true,

  turbopack: {
    // Pin workspace root to avoid lockfile root ambiguity.
    root: process.cwd(),
  },

  // Reduce dev cache flakiness by using in-memory cache for webpack
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: 'memory' } as any;
    }
    return config;
  },

  // Ensure serverless Chromium binaries/assets are included in the Vercel
  // Serverless Function bundle. We avoid externalizing these packages so the
  // traced files are packaged with the function.
  // Extra safety: explicitly include chromium binaries for the PDF route.
  // This helps when dynamic imports prevent static analysis.
  outputFileTracingIncludes: {
    // Match the API route handler for PDF generation
    'app/api/pdf/invoice/route': ['./node_modules/@sparticuz/**'],
    'app/api/pdf/invoice/route.ts': ['./node_modules/@sparticuz/**'],
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
};

export default nextConfig;
