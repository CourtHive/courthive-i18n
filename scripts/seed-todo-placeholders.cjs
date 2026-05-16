/* global console, process, __dirname */
/**
 * One-shot scaffolder: for every leaf key present in any locale but missing
 * from others, inject `__TODO__` at the missing path. This is the
 * sentinel-based parity-repair step described in
 * `Mentat/planning/I18N_DELIVERY.md` ("__TODO__ vs null" section).
 *
 * Used once during the initial migration from TMX to fix structural drift
 * inherited from bundled locales. Going forward, the TMX -> courthive-i18n
 * sync GitHub Action injects __TODO__ placeholders on key-add.
 *
 * Usage: node scripts/seed-todo-placeholders.cjs
 */
const fs = require('fs');
const path = require('path');

const TODO = '__TODO__';
const dir = path.join(__dirname, '..', 'src', 'locales');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

function collectLeafKeys(obj, prefix, acc) {
  for (const k of Object.keys(obj)) {
    const fullPath = prefix ? prefix + '.' + k : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectLeafKeys(v, fullPath, acc);
    } else {
      acc.add(fullPath);
    }
  }
}

function hasKey(obj, dottedPath) {
  const parts = dottedPath.split('.');
  let cursor = obj;
  for (const p of parts) {
    if (cursor && typeof cursor === 'object' && !Array.isArray(cursor) && p in cursor) {
      cursor = cursor[p];
    } else {
      return false;
    }
  }
  return true;
}

function setKey(obj, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    // If a non-object value is sitting at this path (collision), skip.
    if (cursor[p] === undefined || cursor[p] === null) {
      cursor[p] = {};
    } else if (typeof cursor[p] !== 'object' || Array.isArray(cursor[p])) {
      console.warn(`  collision at ${parts.slice(0, i + 1).join('.')} — skipping ${dottedPath}`);
      return false;
    }
    cursor = cursor[p];
  }
  cursor[parts[parts.length - 1]] = value;
  return true;
}

const byFile = {};
const unionKeys = new Set();
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  byFile[f] = data;
  collectLeafKeys(data, '', unionKeys);
}

let totalAdded = 0;
for (const f of files) {
  const data = byFile[f];
  let added = 0;
  for (const key of unionKeys) {
    if (!hasKey(data, key)) {
      if (setKey(data, key, TODO)) added++;
    }
  }
  if (added > 0) {
    fs.writeFileSync(path.join(dir, f), JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`${f}: added ${added} __TODO__ placeholders`);
    totalAdded += added;
  } else {
    console.log(`${f}: already complete`);
  }
}

console.log(`\nTotal __TODO__ placeholders added: ${totalAdded}`);
process.exit(0);
