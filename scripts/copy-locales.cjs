/* global console, process, __dirname */
/**
 * Copies src/locales/*.json into dist/locales/ as part of `pnpm build`,
 * resolving both translator sentinels on the way out.
 * tsc does not copy JSON files even with resolveJsonModule, so this step
 * is needed to ship the locales as part of the published artifact.
 *
 * Runs after `tsc` and before `manifest.gen` so the manifest can scan
 * the dist/locales/ tree.
 *
 * ## `__TODO__` is stripped on the way out
 *
 * `__TODO__` is a marker for translators, not a translation. i18next only falls
 * back to `fallbackLng` when a key is **absent** — a key whose value is the
 * string `__TODO__` is present, so it renders literally. Shipping the sentinel
 * therefore puts `__TODO__` on screen wherever a translation is outstanding,
 * which is strictly worse than showing English.
 *
 * That was live: on 2026-08-16 `GET /i18n/locales/fr` in production returned 89
 * keys valued `__TODO__`, including `schedule.callToCourt`, so a French TD saw
 * `__TODO__` in the schedule UI.
 *
 * So `src` keeps the sentinel — it is the translator's working file and what
 * `todo-report` / `compare-keys` / the manifest's completeness metric read — and
 * `dist` omits those keys entirely. An omitted key is exactly what i18next's
 * per-key fallback expects, so an untranslated string renders in English.
 *
 * Consequence worth knowing: dist locales are NOT key-identical to `src`, and a
 * non-English dist locale has fewer keys than `en`. The `compare-keys` parity
 * gate runs against `src`, which is the tree parity actually matters for.
 *
 * ## `__STALE__` is a prefix, and only the prefix is stripped
 *
 * The second sentinel marks a *different* failure: the key has a real
 * translation, but the English it was translated from has since changed, so the
 * translation may now answer the wrong question (`merge-source-en.cjs` seeds it
 * — see that script's header for the `pages.venues.saveToTournament` case).
 *
 * `__STALE__` is written as a PREFIX on the retained translation
 * (`__STALE__Enregistrer dans le tournoi`), not as a replacement value, and only
 * the prefix is removed here. That distinction is the whole point: dropping the
 * key like `__TODO__` would make it absent, and an absent key falls back to
 * English — so a copy edit in English would silently un-translate the string for
 * every non-English user. Keeping the translation on screen while
 * `todo-report` / `manifest.gen` count the key as debt is the trade being made.
 */
const fs = require('fs');
const path = require('path');

const TODO = '__TODO__';
const STALE = '__STALE__';

const src = path.join(__dirname, '..', 'src', 'locales');
const dest = path.join(__dirname, '..', 'dist', 'locales');

/**
 * Deep-copy `value`, dropping every leaf equal to `__TODO__` and unwrapping the
 * `__STALE__` prefix from every leaf that carries it. Objects left empty by that
 * pruning are dropped too, so a fully-untranslated namespace does not ship as
 * `{}` — i18next treats an empty object as a present-but-unusable node rather
 * than falling through to English.
 *
 * Returns `undefined` when the whole subtree pruned away.
 */
function pruneSentinels(value) {
  if (value === TODO) return undefined;
  if (typeof value === 'string' && value.startsWith(STALE)) return value.slice(STALE.length);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const pruned = pruneSentinels(child);
    if (pruned !== undefined) out[key] = pruned;
  }
  return Object.keys(out).length ? out : undefined;
}

if (!fs.existsSync(src)) {
  console.error('copy-locales: missing src/locales — aborting');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

const files = fs.readdirSync(src).filter((f) => f.endsWith('.json'));
let droppedTotal = 0;
let unwrappedTotal = 0;

for (const f of files) {
  const parsed = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  const dropped = countTodos(parsed);
  const unwrapped = countStale(parsed);
  const pruned = pruneSentinels(parsed) ?? {};
  droppedTotal += dropped;
  unwrappedTotal += unwrapped;
  // Trailing newline so the emitted file matches prettier's output shape.
  fs.writeFileSync(path.join(dest, f), `${JSON.stringify(pruned, null, 2)}\n`, 'utf8');
  if (dropped || unwrapped) {
    console.log(`copy-locales: ${f} — dropped ${dropped} __TODO__ key(s), unwrapped ${unwrapped} __STALE__ key(s)`);
  }
}

function countTodos(value) {
  if (value === TODO) return 1;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value).reduce((n, child) => n + countTodos(child), 0);
}

function countStale(value) {
  if (typeof value === 'string') return value.startsWith(STALE) ? 1 : 0;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value).reduce((n, child) => n + countStale(child), 0);
}

console.log(
  `copy-locales: copied ${files.length} locale files to ${dest} ` +
    `(${droppedTotal} __TODO__ key(s) dropped, ${unwrappedTotal} __STALE__ prefix(es) stripped)`,
);
