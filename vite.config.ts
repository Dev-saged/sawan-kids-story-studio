import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Pure client-side build: no Node/Express server, no server-only env injection.
// The Gemini API key is read at build time from VITE_GEMINI_API_KEY (see .env.example)
// via Vite's built-in import.meta.env mechanism — no custom `define` block needed.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0', // required so the app is reachable from the phone's browser under Termux
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
