import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Muss mit vite.config.ts übereinstimmen, damit `@template-core/*`-Imports
    // (z. B. in useConvergeAuth) auch im Test-Resolver auflösen.
    alias: {
      '@template-core': path.resolve(__dirname, '../template-core'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
});
