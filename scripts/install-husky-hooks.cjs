/* global console, process, __dirname */
/**
 * Copies hook templates from scripts/husky/ into .husky/ and marks them
 * executable. Invoked from package.json `prepare` after `husky` itself
 * has bootstrapped the .husky/ directory.
 *
 * Why: the harness used to scaffold this repo cannot write to dotfile
 * paths starting with `.husky`, so the canonical hook bodies live under
 * scripts/husky/ in version control. This script reconciles them with
 * the live .husky/ folder on every install.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'husky');
const destDir = path.join(__dirname, '..', '.husky');

if (!fs.existsSync(srcDir)) {
  console.warn('install-husky-hooks: scripts/husky missing, skipping');
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  // husky CLI didn't bootstrap — either a CI install with --ignore-scripts
  // or a sandbox without write access to .husky. Either way, do nothing.
  console.warn('install-husky-hooks: .husky directory missing, skipping');
  process.exit(0);
}

const hooks = fs.readdirSync(srcDir);
for (const hook of hooks) {
  const src = path.join(srcDir, hook);
  const dest = path.join(destDir, hook);
  fs.copyFileSync(src, dest);
  try {
    fs.chmodSync(dest, 0o755);
  } catch (err) {
    console.warn('install-husky-hooks: chmod failed for ' + dest + ': ' + err.message);
  }
  console.log('install-husky-hooks: installed ' + hook);
}
