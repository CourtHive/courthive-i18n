/* global console, process, require, __dirname */
/**
 * Post-build gate: no `__TODO__` sentinel may reach `dist/locales/`.
 *
 * i18next falls back to `fallbackLng` only when a key is **absent**. A key whose
 * value is the string `__TODO__` is present, so it renders literally — meaning a
 * shipped sentinel puts `__TODO__` on screen wherever a translation is
 * outstanding, which is strictly worse than showing English.
 *
 * This is not hypothetical. On 2026-08-16, production `GET /i18n/locales/fr`
 * returned 89 keys valued `__TODO__` — `schedule.callToCourt` among them, so a
 * French TD read `__TODO__` in the schedule UI. `copy-locales.cjs` now strips the
 * sentinel on the way to dist; this asserts it stays stripped.
 *
 * Also checks the inverse, because a stripper that removed *everything* would
 * pass a naive "no __TODO__" check: every locale must still carry a substantial
 * number of real translations, and `en` must be untouched.
 *
 * Usage: node scripts/check-dist-no-todo.cjs   (chained into `pnpm build`)
 */
const fs = require('fs');
const path = require('path');

const TODO = '__TODO__';
const distLocales = path.join(__dirname, '..', 'dist', 'locales');
const srcLocales = path.join(__dirname, '..', 'src', 'locales');

if (!fs.existsSync(distLocales)) {
  console.error('check-dist-no-todo: dist/locales missing — run `pnpm build` first');
  process.exit(1);
}

/** Every `dotted.path` whose leaf equals the sentinel. */
function todoPaths(value, prefix, acc) {
  if (value === TODO) {
    acc.push(prefix);
    return acc;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return acc;
  for (const [key, child] of Object.entries(value)) {
    todoPaths(child, prefix ? `${prefix}.${key}` : key, acc);
  }
  return acc;
}

function countLeaves(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 1;
  return Object.values(value).reduce((n, child) => n + countLeaves(child), 0);
}

const files = fs.readdirSync(distLocales).filter((f) => f.endsWith('.json'));
if (!files.length) {
  console.error('check-dist-no-todo: no locale files in dist/locales');
  process.exit(1);
}

let failed = false;

for (const file of files) {
  const code = file.replace(/\.json$/, '');
  const parsed = JSON.parse(fs.readFileSync(path.join(distLocales, file), 'utf8'));

  const offenders = todoPaths(parsed, '', []);
  if (offenders.length) {
    failed = true;
    console.error(
      `check-dist-no-todo: ${file} ships ${offenders.length} __TODO__ key(s) — ` +
        `these render literally instead of falling back to English. e.g. ${offenders.slice(0, 3).join(', ')}`,
    );
  }

  // Inverse guard: stripping must not have gutted the locale. Compare against
  // src so the threshold tracks the corpus instead of a magic number.
  const srcPath = path.join(srcLocales, file);
  if (fs.existsSync(srcPath)) {
    const srcLeaves = countLeaves(JSON.parse(fs.readFileSync(srcPath, 'utf8')));
    const distLeaves = countLeaves(parsed);
    if (distLeaves < srcLeaves * 0.5) {
      failed = true;
      console.error(
        `check-dist-no-todo: ${file} kept only ${distLeaves}/${srcLeaves} keys — ` +
          `the strip is removing far more than untranslated leaves`,
      );
    }
  }

  if (code === 'en') {
    // English is the fallback: it must never lose a key to this pipeline.
    const srcEn = JSON.parse(fs.readFileSync(path.join(srcLocales, file), 'utf8'));
    if (countLeaves(parsed) !== countLeaves(srcEn)) {
      failed = true;
      console.error('check-dist-no-todo: dist/en.json key count differs from src — the fallback locale was altered');
    }
  }
}

if (failed) process.exit(1);
console.log(`check-dist-no-todo: OK — ${files.length} locale files carry no __TODO__`);
