# @courthive/i18n

Translation locales for the CourtHive ecosystem. Source-of-truth bundle
served at runtime by `competition-factory-server` to TMX clients; see
[`Mentat/planning/I18N_DELIVERY.md`](../Mentat/planning/I18N_DELIVERY.md)
for the full delivery architecture.

## Layout

```text
src/
  locale-labels.ts     # Per-locale label + RTL flag
  manifest.gen.ts      # Build-time CLI: SHA256, keyCount, completeness
  locales/
    en.json            # Source of truth for English (mirrored from TMX)
    fr.json
    es.json
    pt-BR.json
    de.json
    ar.json
    zh-CN.json
scripts/
  compare-keys.cjs     # CI gate: fails on key drift / duplicate keys
  merge-source-en.cjs  # Merges a consumer's en.json in; seeds __TODO__ / __STALE__
  copy-locales.cjs     # src -> dist; drops __TODO__, unwraps __STALE__
  check-dist-no-todo.cjs    # Build gate: no sentinel may reach dist
  todo-report.cjs      # Backlog report consumed by i18n-todo-reminder
  install-husky-hooks.cjs   # Copies scripts/husky/* into .husky/ on prepare
  husky/
    pre-commit         # Hook body (lint + check-types + compare-keys)
    commit-msg         # Hook body (commitlint)
```

## Build artifact (`dist/`)

`pnpm build` emits:

- `dist/locales/*.json` — copies of every source locale.
- `dist/locale-labels.js` + `.d.ts` — label/RTL metadata.
- `dist/manifest.json` — runtime manifest (SHA256 per locale, key count,
  completeness, RTL flag) used by CFS to serve `GET /i18n/manifest`.
- `dist/index.js` + `.d.ts` — re-exports the manifest type and labels.

## The two translator sentinels

`completeness = 1 - ((__TODO__ + __STALE__ count) / total keys)`, measured
against `src` — the only tree where the sentinels still exist.

| sentinel    | means                                                              | shape in `src`                         | what `dist` ships                     | what the user sees                 |
| ----------- | ------------------------------------------------------------------ | -------------------------------------- | ------------------------------------- | ---------------------------------- |
| `__TODO__`  | no translation yet                                                 | replaces the value                     | key **dropped**                       | English (i18next per-key fallback) |
| `__STALE__` | a translation exists, but the English it was made from has changed | **prefix** on the retained translation | prefix **stripped**, translation kept | the old translation                |

`merge-source-en.cjs` seeds both: `__TODO__` for keys the source adds,
`__STALE__` for keys whose English value changes under an existing
translation. Translators fill in / confirm them and merge a follow-up PR
that brings completeness back to 1.0.

`__STALE__` is deliberately a _prefix_, not a replacement value. Replacing
the value and dropping it like `__TODO__` would make the key **absent**, and
an absent key falls back to English — so a copy edit in English would
silently un-translate the string for every non-English user. Keeping the
translation on screen while the metric counts it as debt is the trade.

Neither sentinel may reach `dist`: `check-dist-no-todo.cjs` fails the build
on either. A shipped `__TODO__` renders literally (this was live in
production on 2026-08-16 — a French TD read `__TODO__` in the schedule UI);
a shipped `__STALE__` would prepend the marker to a real translation.

## Scripts

```bash
pnpm build          # tsc → dist/, then node dist/manifest.gen.js
pnpm check-types    # tsc --noEmit
pnpm lint           # ESLint — non-mutating, fails on any warning
pnpm lint:fix       # ESLint with auto-fix (rewrites source)
pnpm format         # prettier --write
pnpm test           # node scripts/compare-keys.cjs  (key parity gate)
```

## Compare-keys gate

`scripts/compare-keys.cjs` is the canonical key-parity script — promoted
from `TMX/src/i18n/compare-keys.cjs`. It exits with code 1 on:

- duplicate keys within a single locale
- any leaf key present in one locale but missing in another

CI runs it on every PR and push. Pre-commit (husky) runs it too.

## Consumed by

| Repo                         | How                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `competition-factory-server` | `pnpm` dep (`link:../courthive-i18n` in dev); on bootstrap copies `dist/locales/*` + `dist/manifest.json` to a writable `i18n/` directory and serves them via `GET /i18n/*` endpoints. |
| `TMX` (eventually)           | Reads from CFS at runtime — never depends on `@courthive/i18n` directly.                                                                                                               |

## License

MIT
