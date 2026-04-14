import { join } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  cacheDir: process.env.SMARTMALL_VITE_CACHE || join(process.env.TEMP || process.cwd(), 'smartmall-vite-cache'),
  plugins: [
    react(),
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
  },
});
