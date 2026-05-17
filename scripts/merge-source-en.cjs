/* global console, process, require, __dirname */
/**
 * Merge a source repo's `en.json` into `courthive-i18n`'s `src/locales/en.json`,
 * then seed `__TODO__` placeholders in every non-English locale for any key
 * the source added.
 *
 * Called from the `sync-i18n.yml` workflow in each consumer repo (TMX,
 * courthive-public). The consumer's workflow:
 *   1. Checks out the consumer repo
 *   2. Checks out CourtHive/courthive-i18n alongside
 *   3. Runs this script: `node scripts/merge-source-en.cjs --source <path> --label <name>`
 *   4. Opens a PR against courthive-i18n with the result
 *
 * Merge policy:
 *   - New keys (in source, not in dest)         → ADD verbatim
 *   - Changed keys (different value in source)  → UPDATE to source value
 *   - Keys absent from source                   → LEAVE in dest (another
 *     consumer might still need them; never auto-delete)
 *
 * Output:
 *   - Writes the updated en.json + non-en files
 *   - Prints a markdown summary to STDOUT (consumed by the workflow for
 *     the PR body)
 *   - Sets process.exit(0) on success, exit(1) on any structural error,
 *     exit(2) when there are no changes (the workflow uses this to skip
 *     opening an empty PR)
 *
 * Usage:
 *   node scripts/merge-source-en.cjs --source /path/to/source/en.json --label TMX
 */
const fs = require('fs');
const path = require('path');

const TODO = '__TODO__';
const args = parseArgs(process.argv.slice(2));
if (!args.source) {
  console.error('Missing --source <path-to-en.json>');
  process.exit(1);
}
if (!args.label) {
  console.error('Missing --label <consumer-name>');
  process.exit(1);
}

const i18nRoot = path.join(__dirname, '..');
const localesDir = path.join(i18nRoot, 'src', 'locales');
const destEnPath = path.join(localesDir, 'en.json');

const source = readJson(args.source);
const dest = readJson(destEnPath);

const { added, changed } = mergeInto(source, dest, []);

if (!added.length && !changed.length) {
  console.error('[merge-source-en] no changes; skipping PR.');
  process.exit(2);
}

writeJson(destEnPath, dest);

// Seed __TODO__ in every non-en locale so the structural diff is zero
// even before translators have filled the new keys in.
const newKeys = [...added];
const otherLocales = fs
  .readdirSync(localesDir)
  .filter((f) => f.endsWith('.json') && f !== 'en.json');

for (const file of otherLocales) {
  const p = path.join(localesDir, file);
  const locale = readJson(p);
  let mutated = false;
  for (const dotted of newKeys) {
    if (!hasPath(locale, dotted)) {
      setPath(locale, dotted, TODO);
      mutated = true;
    }
  }
  if (mutated) writeJson(p, locale);
}

// Markdown summary for the PR body.
const lines = [];
lines.push(`Source: **${args.label}**`);
lines.push('');
if (added.length) {
  lines.push(`### Added (${added.length})`);
  for (const k of added.slice(0, 200)) lines.push('- `' + k + '`');
  if (added.length > 200) lines.push(`- _…and ${added.length - 200} more_`);
  lines.push('');
}
if (changed.length) {
  lines.push(`### Updated (${changed.length})`);
  for (const k of changed.slice(0, 200)) lines.push('- `' + k + '`');
  if (changed.length > 200) lines.push(`- _…and ${changed.length - 200} more_`);
  lines.push('');
}
lines.push('### Notes');
lines.push(`- Non-English locales had \`__TODO__\` injected for each new key (${added.length} key(s) total).`);
lines.push('- Keys absent from the source were left untouched; deletions need a manual review here.');

process.stdout.write(lines.join('\n') + '\n');

// ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(`[merge-source-en] failed to read JSON at ${p}: ${err.message}`);
    process.exit(1);
  }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Recursively merge `src` into `dst`. Tracks added + changed leaf paths. */
function mergeInto(src, dst, prefix) {
  const added = [];
  const changed = [];
  for (const key of Object.keys(src)) {
    const srcVal = src[key];
    const dstVal = dst[key];
    const fullPath = [...prefix, key].join('.');

    if (isPlainObject(srcVal)) {
      if (!isPlainObject(dstVal)) {
        // Whole subtree is new (or replacing a non-object) — count every leaf as added.
        dst[key] = {};
        const nested = mergeInto(srcVal, dst[key], [...prefix, key]);
        added.push(...nested.added);
        changed.push(...nested.changed);
      } else {
        const nested = mergeInto(srcVal, dstVal, [...prefix, key]);
        added.push(...nested.added);
        changed.push(...nested.changed);
      }
    } else if (dstVal === undefined) {
      dst[key] = srcVal;
      added.push(fullPath);
    } else if (dstVal !== srcVal) {
      dst[key] = srcVal;
      changed.push(fullPath);
    }
  }
  return { added, changed };
}

function hasPath(obj, dotted) {
  const parts = dotted.split('.');
  let cursor = obj;
  for (const p of parts) {
    if (!isPlainObject(cursor) || !(p in cursor)) return false;
    cursor = cursor[p];
  }
  return true;
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cursor[p] === undefined) cursor[p] = {};
    if (!isPlainObject(cursor[p])) {
      // collision with a scalar — skip to avoid corrupting the file
      return false;
    }
    cursor = cursor[p];
  }
  cursor[parts[parts.length - 1]] = value;
  return true;
}
