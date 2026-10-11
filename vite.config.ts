import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 8000 },
  build: {
    chunkSizeWarningLimit: 2000, // Phaser is one big chunk; that's fine
    // Two pages: the game (index.html) and Oops Academy (learn.html)
    rolldownOptions: { input: { main: 'index.html', learn: 'learn.html' } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
