import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Le variabili con prefisso VITE_ sono automaticamente esposte al client
// tramite import.meta.env — non serve definirle manualmente in `define`.
// Vedi: https://vitejs.dev/guide/env-and-mode

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // HMR disabilitato via env per evitare flickering in ambienti CI/cloud
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
