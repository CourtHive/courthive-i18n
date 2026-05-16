# @courthive/i18n

Translation locales for the CourtHive ecosystem. Source-of-truth bundle
served at runtime by `competition-factory-server` to TMX clients; see
[`Mentat/planning/I18N_DELIVERY.md`](../Mentat/planning/I18N_DELIVERY.md)
for the full delivery architecture.

## Layout

```
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

`completeness = 1 - (__TODO__ count / total keys)`. New keys land as
`__TODO__` placeholders in non-English locales; translators fill them
in and merge a follow-up PR that brings completeness back to 1.0.

## Scripts

```bash
pnpm build          # tsc → dist/, then node dist/manifest.gen.js
pnpm check-types    # tsc --noEmit
pnpm lint           # eslint . --fix --max-warnings 0
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

| Repo | How |
|---|---|
| `competition-factory-server` | `pnpm` dep (`link:../courthive-i18n` in dev); on bootstrap copies `dist/locales/*` + `dist/manifest.json` to a writable `i18n/` directory and serves them via `GET /i18n/*` endpoints. |
| `TMX` (eventually) | Reads from CFS at runtime — never depends on `@courthive/i18n` directly. |

## License

MIT
