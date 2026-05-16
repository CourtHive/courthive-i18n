/* global console, process, __dirname */
/**
 * Copies src/locales/*.json into dist/locales/ as part of `pnpm build`.
 * tsc does not copy JSON files even with resolveJsonModule, so this step
 * is needed to ship the locales as part of the published artifact.
 *
 * Runs after `tsc` and before `manifest.gen` so the manifest can scan
 * the dist/locales/ tree.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'locales');
const dest = path.join(__dirname, '..', 'dist', 'locales');

if (!fs.existsSync(src)) {
  console.error('copy-locales: missing src/locales — aborting');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

const files = fs.readdirSync(src).filter((f) => f.endsWith('.json'));
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}
console.log(`copy-locales: copied ${files.length} locale files to ${dest}`);
