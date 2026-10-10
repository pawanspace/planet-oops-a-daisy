import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 8000 },
  test: { include: ['tests/**/*.test.ts'] },
});
