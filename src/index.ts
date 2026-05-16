/**
 * Public entry point for `@courthive/i18n`.
 *
 * Consumers (CFS) typically read locale JSON via the published `dist/`
 * artifact directly (file copy on bootstrap), but the runtime re-exports
 * here are convenient for tooling/tests and for treating the package as
 * a library when desired.
 */

export { localeLabels, type LocaleLabel } from './locale-labels.js';

export type { Manifest, ManifestLocaleEntry } from './manifest.gen.js';
