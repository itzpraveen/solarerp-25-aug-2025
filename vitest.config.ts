import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    // Avoid tinypool worker crashes in some Node/sandbox setups
    threads: false,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Stub Next.js server-only guard so Vitest can import server modules
      'server-only': path.resolve(__dirname, 'vitest.server-only.ts'),
    },
  },
});
