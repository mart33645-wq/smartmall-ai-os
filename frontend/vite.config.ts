import { join } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  cacheDir: process.env.SMARTMALL_VITE_CACHE || join(process.env.TEMP || process.cwd(), 'smartmall-vite-cache'),
  build: {
    emptyOutDir: false,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
  },
});
