import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Pure client-side build: no Node/Express server, no env-injected secrets.
// Each visitor enters their own Gemini key at runtime (stored in sessionStorage).
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0', // required so the app is reachable from the phone's browser under Termux
    allowedHosts: true, // required when the dev server is proxied by AI Studio / a tunnel
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
