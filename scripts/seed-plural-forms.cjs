/* global console, __dirname */
/**
 * Seed every locale's missing CLDR plural forms as `__TODO__` (see plural-forms.cjs).
 *
 * For each plural key English defines, a locale gets the forms its own rules select — Czech `_few` and `_many`,
 * Arabic `_zero` `_two` `_few` `_many`, French `_many` (1,000,000), … — inserted beside the forms it already has.
 * `__TODO__` keeps today's behaviour until a translator fills it: copy-locales drops the key, and i18next falls back
 * to English as it already did for that count. compare-keys.cjs fails until every form exists.
 *
 * Idempotent; run it after adding a locale, or after a merge brings in a plural key.
 * Usage: node scripts/seed-plural-forms.cjs
 */
const fs = require('fs');
const path = require('path');
const { CATEGORIES, formsFor, localeOf, pluralBases } = require('./plural-forms.cjs');

const TODO = '__TODO__';
const dir = path.join(__dirname, '..', 'src', 'locales');

function flattenKeys(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenKeys(v, key, out);
    else out.add(key);
  }
  return out;
}

/** The object holding `dotted`'s leaf, or undefined. */
function parentOf(obj, dotted) {
  const parts = dotted.split('.');
  let cursor = obj;
  for (const p of parts.slice(0, -1)) {
    if (!cursor || typeof cursor !== 'object' || !(p in cursor)) return undefined;
    cursor = cursor[p];
  }
  return cursor && typeof cursor === 'object' ? cursor : undefined;
}

/** Insert `leaf: value` into `parent` after the last of `siblings` present, keeping key order otherwise. */
function insertAfter(parent, leaf, value, siblings) {
  const keys = Object.keys(parent);
  const anchor = Math.max(...siblings.map((s) => keys.indexOf(s)));
  const entries = Object.entries(parent);
  entries.splice(anchor + 1, 0, [leaf, value]);
  for (const k of keys) delete parent[k];
  for (const [k, v] of entries) parent[k] = v;
}

const englishKeys = flattenKeys(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')), '', new Set());
const bases = pluralBases(englishKeys);

let total = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const locale = localeOf(file);
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const present = flattenKeys(data, '', new Set());
  let seeded = 0;
  for (const base of bases) {
    const parent = parentOf(data, base);
    if (!parent) continue; // the base's object is missing entirely — compare-keys reports it
    const leafBase = base.split('.').pop();
    for (const key of formsFor(base, locale, englishKeys).required) {
      if (present.has(key)) continue;
      if (key === base + '_one' && present.has(base)) continue; // bare key serves as the singular
      const siblings = [leafBase, ...CATEGORIES.map((c) => `${leafBase}_${c}`)].filter((s) => s in parent);
      insertAfter(parent, key.split('.').pop(), TODO, siblings);
      present.add(key);
      seeded++;
    }
  }
  if (seeded) fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2) + '\n');
  console.log(`${file}: ${seeded} plural form(s) seeded`);
  total += seeded;
}
console.log(`seed-plural-forms: ${total} form(s) seeded as ${TODO}.`);
