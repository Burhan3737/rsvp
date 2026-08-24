import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
      // `server-only` throws when imported outside a Next server bundle. Stub it for tests.
      'server-only': path.resolve(process.cwd(), 'tests/stubs/server-only.ts'),
    },
  },
});
