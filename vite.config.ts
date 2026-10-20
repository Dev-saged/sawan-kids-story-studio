import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { CURRENT_VERSION } from './src/version';

const PLACEHOLDER = 'MY_GEMINI_API_KEY';

// إضافة صغيرة تولّد dist/version.json وتحقن رقم الإصدار في dist/sw.js وقت البناء
const versionManifestPlugin = (): Plugin => ({
  name: 'sajed-version-manifest',
  closeBundle() {
    const distDir = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(distDir)) return;

    const versionPayload = {
      version: CURRENT_VERSION.version,
      buildNumber: CURRENT_VERSION.buildNumber,
      releaseDate: CURRENT_VERSION.releaseDate,
      commitTag: CURRENT_VERSION.commitTag,
    };
    fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionPayload, null, 2), 'utf-8');

    const swPath = path.join(distDir, 'sw.js');
    if (fs.existsSync(swPath)) {
      const swContent = fs.readFileSync(swPath, 'utf-8');
      const injectedSw = swContent
        .replace(/__APP_VERSION__/g, CURRENT_VERSION.version)
        .replace(/sawan-v[0-9]+\.[0-9]+\.[0-9]+/g, `sawan-v${CURRENT_VERSION.version}`);
      fs.writeFileSync(swPath, injectedSw, 'utf-8');
    }
  },
});

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
    plugins: [react(), tailwindcss(), versionManifestPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
