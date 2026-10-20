import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const versionTs = fs.readFileSync(path.join(root, 'src/version.ts'), 'utf-8');
const configTs = fs.readFileSync(path.join(root, 'src/config.ts'), 'utf-8');
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');

const versionMatch = /version:\s*'([^']+)'/.exec(versionTs);
const buildMatch = /buildNumber:\s*(\d+)/.exec(versionTs);
const dateMatch = /releaseDate:\s*'([^']+)'/.exec(versionTs);

if (!versionMatch || !buildMatch || !dateMatch) {
  console.error('[check-version] Could not parse CURRENT_VERSION fields from src/version.ts');
  process.exit(1);
}

const expected = versionMatch[1];
const buildNumber = Number(buildMatch[1]);
const releaseDate = dateMatch[1];

// التحقق من قاعدة الأرقام الأحادية (0..9) في الخانات الفرعية
const parts = expected.split('.').map(Number);
if (parts.length !== 3 || parts[1] < 0 || parts[1] > 9 || parts[2] < 0 || parts[2] > 9) {
  console.error(`[check-version] Invalid version format ${expected}: minor and patch must be 0..9`);
  process.exit(1);
}

if (!configTs.includes('CURRENT_VERSION.version')) {
  console.error('[check-version] src/config.ts must read APP_VERSION from CURRENT_VERSION.version');
  process.exit(1);
}

if (pkgJson.version !== expected) {
  console.error(`[check-version] package.json version (${pkgJson.version}) !== src/version.ts (${expected})`);
  process.exit(1);
}

if (!readme.includes(`v${expected}`) && !readme.includes(expected)) {
  console.error(`[check-version] README.md does not mention current version v${expected}`);
  process.exit(1);
}

// توليد public/version.json تلقائياً من src/version.ts
const publicVersionPath = path.join(root, 'public/version.json');
const versionPayload = {
  version: expected,
  buildNumber,
  releaseDate,
};
fs.writeFileSync(publicVersionPath, `${JSON.stringify(versionPayload, null, 2)}\n`, 'utf-8');

console.log(`[check-version] Version consistency verified & public/version.json generated: v${expected} (build ${buildNumber})`);
