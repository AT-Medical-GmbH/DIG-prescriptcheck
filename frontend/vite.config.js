import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Entwicklung: API-Aufrufe an das lokale Backend weiterleiten (Standard-Port 3000).
// Produktion: NGINX liefert die statischen Dateien aus und leitet /api an das Backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_TARGET || 'http://localhost:3000',
      '/.well-known': process.env.VITE_API_TARGET || 'http://localhost:3000',
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
