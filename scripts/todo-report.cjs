/* global console, process, require, __dirname */
/**
 * i18n translation-backlog report.
 *
 * Walks every `src/locales/<code>.json`, counts `__TODO__` placeholder leaves
 * against total leaves, and prints a Markdown summary. Consumed by the
 * `i18n-todo-reminder` scheduled workflow to surface the untranslated backlog
 * as a tracking issue.
 *
 * Leaf/TODO counting mirrors `src/manifest.gen.ts` (arrays count as a single
 * leaf; `__TODO__` string values are the untranslated sentinel) so the
 * completeness figures here match the published runtime manifest.
 *
 * English (`en.json`) is the source of truth and is excluded from the backlog.
 *
 * Flags:
 *   --total   print only the grand total of `__TODO__` leaves (for CI branching)
 */
const fs = require('fs');
const path = require('path');

const TODO = '__TODO__';
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

const files = fs
  .readdirSync(localesDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const rows = [];
let grandTodo = 0;
for (const file of files) {
  const code = file.replace(/\.json$/, '');
  if (code === 'en') continue; // source of truth — nothing to translate
  const parsed = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
  const total = countLeafKeys(parsed);
  const todo = countTodos(parsed);
  grandTodo += todo;
  const pct = total > 0 ? (((total - todo) / total) * 100).toFixed(1) : '100.0';
  rows.push({ code, total, todo, pct });
}

if (process.argv.includes('--total')) {
  console.log(String(grandTodo));
  process.exit(0);
}

const lines = [];
lines.push('| Locale | Untranslated (`__TODO__`) | Translated | Completeness |');
lines.push('| --- | ---: | ---: | ---: |');
for (const r of rows.sort((a, b) => b.todo - a.todo)) {
  lines.push(`| \`${r.code}\` | ${r.todo} | ${r.total - r.todo} / ${r.total} | ${r.pct}% |`);
}
lines.push('');
lines.push(`**Total untranslated placeholders:** ${grandTodo}`);
console.log(lines.join('\n'));
