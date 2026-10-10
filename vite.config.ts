import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 8000 },
  build: { chunkSizeWarningLimit: 2000 }, // Phaser is one big chunk; that's fine
  test: { include: ['tests/**/*.test.ts'] },
});
