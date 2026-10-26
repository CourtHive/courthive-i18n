/* global module */
/**
 * Plural forms per locale, for the scripts that check and seed keys.
 *
 * i18next resolves `t('key', { count })` to `key_<category>`, where the category comes from the locale's CLDR rules
 * (`Intl.PluralRules`). English has two (`one`, `other`); Czech has four (`one` 1, `few` 2-4, `many` decimals,
 * `other`), Croatian three, Arabic six, and French, Spanish and Portuguese use `many` at 1,000,000. A locale that
 * carries only English's two forms answers `key_few` with a miss, and i18next falls back to ENGLISH — a Czech user
 * read "2 matches". So a plural key is complete in a locale when it has that locale's forms, not English's.
 *
 * A plural key is one English carries as `<base>_other` (i18next requires `_other`).
 */
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** `pt-BR.json` → `pt-BR`. */
function localeOf(file) {
  return file.replace(/\.json$/, '');
}

/** The locale's CLDR plural categories, in CLDR order. */
function categoriesOf(locale) {
  const found = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  return CATEGORIES.filter((c) => found.includes(c));
}

/** `crowd.sessions_few` → `crowd.sessions`; undefined for a key with no plural suffix. */
function baseOf(key) {
  return PLURAL_SUFFIX.test(key) ? key.replace(PLURAL_SUFFIX, '') : undefined;
}

/** The plural bases English defines: every `<base>` with a `<base>_other` leaf. */
function pluralBases(englishKeys) {
  const bases = new Set();
  for (const key of englishKeys) if (key.endsWith('_other')) bases.add(key.slice(0, -'_other'.length));
  return bases;
}

/**
 * The keys a locale must carry for one plural base: its own categories. `allowed` adds English's forms, which a
 * locale may keep though its rules never select them (zh-CN has only `other`, but carries `_one` from English).
 */
function formsFor(base, locale, englishKeys) {
  const required = categoriesOf(locale).map((c) => `${base}_${c}`);
  const allowed = new Set(required);
  for (const c of CATEGORIES) if (englishKeys.has(`${base}_${c}`)) allowed.add(`${base}_${c}`);
  return { required, allowed };
}

module.exports = { CATEGORIES, PLURAL_SUFFIX, localeOf, categoriesOf, baseOf, pluralBases, formsFor };
