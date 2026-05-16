/**
 * Build-time CLI: scans `dist/locales/*.json`, computes a SHA256 per
 * file, counts keys and `__TODO__` sentinels, and emits
 * `dist/manifest.json`.
 *
 * The manifest is the authoritative contract served by CFS at
 * `GET /i18n/manifest` — its shape is documented in
 * `Mentat/planning/I18N_DELIVERY.md`.
 *
 * Invocation: `node dist/manifest.gen.js` (chained after `tsc` in
 * `pnpm build`).
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { localeLabels, type LocaleLabel } from './locale-labels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ManifestLocaleEntry {
  /** BCP47 language tag (e.g. 'en', 'pt-BR', 'zh-CN'). */
  code: string;
  /** English label. */
  label: string;
  /** Native label. */
  nativeLabel: string;
  /** `sha256-<hex>` content hash of the locale JSON file. */
  version: string;
  /** File size in bytes. */
  size: number;
  /** Total leaf-key count. */
  keyCount: number;
  /** 1 - (__TODO__ count / total keys). */
  completeness: number;
  /** Right-to-left rendering required. */
  rtl: boolean;
}

export interface Manifest {
  /** `@courthive/i18n@<package-version>`. */
  version: string;
  /** ISO timestamp the manifest was generated at. */
  generatedAt: string;
  locales: ManifestLocaleEntry[];
}

const TODO_SENTINEL = '__TODO__';

function countLeafKeys(obj: unknown): number {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 1;
  let n = 0;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    n += countLeafKeys((obj as Record<string, unknown>)[key]);
  }
  return n;
}

function countTodos(obj: unknown): number {
  if (typeof obj === 'string') return obj === TODO_SENTINEL ? 1 : 0;
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 0;
  let n = 0;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    n += countTodos((obj as Record<string, unknown>)[key]);
  }
  return n;
}

function readPackageVersion(): string {
  // dist/manifest.gen.js → dist/ → repo root
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string; version: string };
  return `${pkg.name}@${pkg.version}`;
}

function build(): Manifest {
  const localesDir = join(__dirname, 'locales');
  const files = readdirSync(localesDir).filter((f) => f.endsWith('.json'));

  const entries: ManifestLocaleEntry[] = [];
  for (const file of files) {
    const code = file.replace(/\.json$/, '');
    const labelEntry: LocaleLabel | undefined = localeLabels[code];
    if (!labelEntry) {
      console.warn(`manifest.gen: locale "${code}" has no entry in locale-labels.ts — skipping`);
      continue;
    }

    const fullPath = join(localesDir, file);
    const raw = readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const sha = createHash('sha256').update(raw).digest('hex');
    const size = statSync(fullPath).size;
    const keyCount = countLeafKeys(parsed);
    const todos = countTodos(parsed);
    const completeness = keyCount > 0 ? 1 - todos / keyCount : 1;

    entries.push({
      code,
      label: labelEntry.label,
      nativeLabel: labelEntry.nativeLabel,
      version: `sha256-${sha}`,
      size,
      keyCount,
      completeness,
      rtl: labelEntry.rtl,
    });

    if (completeness < 1) {
      console.warn(
        `manifest.gen: locale "${code}" is ${(completeness * 100).toFixed(1)}% complete (${todos}/${keyCount} __TODO__)`,
      );
    }
  }

  // Deterministic order: alphabetical by code so manifest diffs are stable.
  entries.sort((a, b) => a.code.localeCompare(b.code));

  return {
    version: readPackageVersion(),
    generatedAt: new Date().toISOString(),
    locales: entries,
  };
}

function main(): void {
  const manifest = build();
  const outPath = join(__dirname, 'manifest.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`manifest.gen: wrote ${outPath} (${manifest.locales.length} locales)`);
}

main();
