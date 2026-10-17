import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// مفتاح المسار المباشر للصور (كما تفعل النسخة المرجعية: define لقيمة GEMINI_API_KEY كما هي):
// - وضع التطوير (معاينة AI Studio): تُحقن القيمة كما هي، حتى لو كانت placeholder تستبدلها منصة AI Studio.
// - حزمة الإنتاج: لا يُحقن أي مفتاح حقيقي أبداً؛ الـplaceholder وحده (ليس سراً) يمر.
// الزائر يُدخل مفتاحه الخاص وقت التشغيل ويُستخدم من المتصفح مباشرة نحو Google.
const PLACEHOLDER = 'MY_GEMINI_API_KEY';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  const raw = (env.GEMINI_API_KEY ?? '').trim();
  const injected = command === 'serve' ? raw : raw === PLACEHOLDER ? raw : '';
  return {
  define: { __DIRECT_KEY__: JSON.stringify(injected) },
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
