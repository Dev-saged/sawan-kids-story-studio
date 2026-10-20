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

const match = /version:\s*'([^']+)'/.exec(versionTs);
if (!match) {
  console.error('[check-version] Could not parse CURRENT_VERSION.version from src/version.ts');
  process.exit(1);
}
const expected = match[1];

if (!configTs.includes('CURRENT_VERSION.version')) {
  console.error('[check-version] src/config.ts must read APP_VERSION from CURRENT_VERSION.version');
  process.exit(1);
}

if (pkgJson.version !== expected) {
  console.error(`[check-version] package.json version (${pkgJson.version}) !== src/version.ts (${expected})`);
  process.exit(1);
}

if (!readme.includes(`v${expected}`)) {
  console.error(`[check-version] README.md does not mention current version v${expected}`);
  process.exit(1);
}

console.log(`[check-version] Version consistency verified: v${expected}`);
