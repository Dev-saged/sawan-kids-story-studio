import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// مفتاح المسار المباشر للصور يُحقن في وضع التطوير فقط (معاينة AI Studio): لا يدخل أي حزمة إنتاج منشورة.
// الزائر يُدخل مفتاحه الخاص وقت التشغيل (sessionStorage) ويُرسل للسيرفر.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  const injected = env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? env.GEMINI_API_KEY : '';
  return {
  define: { __DIRECT_KEY__: JSON.stringify(command === 'serve' ? injected : '') },
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
};
});
