import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    alias: {
      '@logistics/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
