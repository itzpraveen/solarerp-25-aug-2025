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
};

export default nextConfig;
