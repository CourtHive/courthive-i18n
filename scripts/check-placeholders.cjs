/* global console, process, __dirname */
/**
 * Every translation must interpolate the same `{{placeholders}}` as its English source.
 *
 * compare-keys.cjs proves every locale has every key; it cannot see a value that renders wrongly. A translation that
 * writes `{{minute}}` where English has `{{minutes}}` shows the user a literal `{{minute}}`, and one that drops
 * `{{name}}` silently loses the value. Both passed every gate until this check (found drafting the 0.11.0 TODOs,
 * courthive-i18n #161).
 *
 * Rules, per key, per non-English locale:
 *   - a placeholder the locale uses but English does not is an error (it renders literally);
 *   - a placeholder English uses but the locale drops is an error (the value is lost);
 *   - plural forms (`_zero` `_one` `_two` `_few` `_many` `_other`) may add or drop `{{count}}`, which i18next always
 *     supplies: English "One match" and a language that writes "{{count}} zápas" are both right;
 *   - `__TODO__` values are skipped (no translation yet); `__STALE__` values are checked (they render);
 *   - a plural form English does not have (Czech `_few`, Arabic `_two`, … — see plural-forms.cjs) is checked against
 *     English's `_other`.
 * EXCEPTIONS below are allowed differences, each with its reason. Never add one to silence a real mistake.
 *
 * Usage: node scripts/check-placeholders.cjs   (exit 1 on any finding)
 */
const fs = require('fs');
const path = require('path');
const { baseOf } = require('./plural-forms.cjs');

const dir = path.join(__dirname, '..', 'src', 'locales');
const SOURCE = 'en.json';
const TODO = '__TODO__';
const STALE = '__STALE__';
const PLURAL = /_(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /\{\{\s*-?\s*([\w.]+)[^}]*\}\}/g;

/**
 * Allowed differences: key prefix → placeholders a translation may use in place of English's.
 * modals.scoreEntry set labels: English says "{{ordinal}} set"; most languages number the set ("Set {{number}}",
 * "{{number}}. sada"). courthive-components passes both values, so either renders.
 */
const EXCEPTIONS = [{ prefix: 'modals.scoreEntry.', interchangeable: ['ordinal', 'number'] }];

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

function placeholders(value) {
  return new Set([...value.matchAll(PLACEHOLDER)].map((m) => m[1]));
}

function allowed(key) {
  const exception = EXCEPTIONS.find((e) => key.startsWith(e.prefix));
  const free = new Set(exception ? exception.interchangeable : []);
  if (PLURAL.test(key)) free.add('count');
  return free;
}

const source = flatten(JSON.parse(fs.readFileSync(path.join(dir, SOURCE), 'utf8')), '', {});
const locales = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== SOURCE);

let checked = 0;
const findings = [];
for (const file of locales) {
  const target = flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), '', {});
  for (const [key, raw] of Object.entries(target)) {
    // a locale's own plural forms answer to English's `_other`; any other key English lacks is compare-keys' job
    const english = key in source ? source[key] : baseOf(key) && source[baseOf(key) + '_other'];
    if (typeof english !== 'string') continue;
    let value = raw;
    if (value === TODO) continue;
    if (value.startsWith(STALE)) value = value.slice(STALE.length);
    checked++;
    const want = placeholders(english);
    const got = placeholders(value);
    const free = allowed(key);
    const extra = [...got].filter((p) => !want.has(p) && !free.has(p));
    const missing = [...want].filter((p) => !got.has(p) && !free.has(p));
    if (extra.length || missing.length) {
      findings.push(
        `  ${file} ${key}` +
          (extra.length ? `  renders literally: ${extra.map((p) => `{{${p}}}`).join(' ')}` : '') +
          (missing.length ? `  drops: ${missing.map((p) => `{{${p}}}`).join(' ')}` : ''),
      );
    }
  }
}

// control: the check looked at something
if (checked === 0) {
  console.error('check-placeholders: no translated values found — the check looked at nothing.');
  process.exit(1);
}

if (findings.length) {
  console.error(`check-placeholders: ${findings.length} value(s) whose placeholders differ from English:`);
  for (const f of findings) console.error(f);
  process.exit(1);
}
console.log(`check-placeholders: ${checked} translated values across ${locales.length} locales match English.`);
