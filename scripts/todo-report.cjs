/* global console, process, require, __dirname */
/**
 * i18n translation-backlog report.
 *
 * Walks every `src/locales/<code>.json`, counts the two translator sentinels
 * against total leaves, and prints a Markdown summary. Consumed by the
 * `i18n-todo-reminder` scheduled workflow to surface the backlog as a tracking
 * issue.
 *
 * Two kinds of debt, reported separately because they need different work:
 *
 *   - `__TODO__` — no translation at all. The key is dropped on the way to
 *     dist, so the string renders in English.
 *   - `__STALE__<translation>` — a translation exists but the English it was
 *     made from has since changed. The translation still ships (the prefix is
 *     stripped); a translator has to confirm or replace it.
 *
 * Both count against completeness: a stale string is not a correct one.
 *
 * Leaf/sentinel counting mirrors `src/manifest.gen.ts` (arrays count as a
 * single leaf) so the completeness figures here match the published runtime
 * manifest.
 *
 * English (`en.json`) is the source of truth and is excluded from the backlog.
 *
 * Flags:
 *   --total   print only the grand total of outstanding leaves — `__TODO__`
 *             plus `__STALE__` — for CI branching
 */
const fs = require('fs');
const path = require('path');

const TODO = '__TODO__';
const STALE = '__STALE__';
const localesDir = path.join(__dirname, '..', 'src', 'locales');

function countLeafKeys(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 1;
  let n = 0;
  for (const key of Object.keys(obj)) n += countLeafKeys(obj[key]);
  return n;
}

function countTodos(obj) {
  if (typeof obj === 'string') return obj === TODO ? 1 : 0;
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 0;
  let n = 0;
  for (const key of Object.keys(obj)) n += countTodos(obj[key]);
  return n;
}

function countStale(obj) {
  if (typeof obj === 'string') return obj.startsWith(STALE) ? 1 : 0;
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 0;
  let n = 0;
  for (const key of Object.keys(obj)) n += countStale(obj[key]);
  return n;
}

const files = fs
  .readdirSync(localesDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const rows = [];
let grandTodo = 0;
let grandStale = 0;
for (const file of files) {
  const code = file.replace(/\.json$/, '');
  if (code === 'en') continue; // source of truth — nothing to translate
  const parsed = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
  const total = countLeafKeys(parsed);
  const todo = countTodos(parsed);
  const stale = countStale(parsed);
  grandTodo += todo;
  grandStale += stale;
  const outstanding = todo + stale;
  const pct = total > 0 ? (((total - outstanding) / total) * 100).toFixed(1) : '100.0';
  rows.push({ code, total, todo, stale, outstanding, pct });
}

if (process.argv.includes('--total')) {
  console.log(String(grandTodo + grandStale));
  process.exit(0);
}

const lines = [];
lines.push('| Locale | Untranslated (`__TODO__`) | Stale (`__STALE__`) | Translated | Completeness |');
lines.push('| --- | ---: | ---: | ---: | ---: |');
for (const r of rows.sort((a, b) => b.outstanding - a.outstanding || a.code.localeCompare(b.code))) {
  lines.push(`| \`${r.code}\` | ${r.todo} | ${r.stale} | ${r.total - r.outstanding} / ${r.total} | ${r.pct}% |`);
}
lines.push('');
lines.push(`**Total untranslated placeholders:** ${grandTodo}`);
lines.push(`**Total stale translations:** ${grandStale}`);
console.log(lines.join('\n'));
