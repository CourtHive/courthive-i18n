/**
 * Human-readable labels and metadata for each locale carried by
 * `@courthive/i18n`. Used by:
 *
 *   - `src/manifest.gen.ts` to enrich the runtime manifest.
 *   - Consumers (TMX, CFS) that need a label without round-tripping
 *     through the manifest fetch.
 *
 * Adding a new locale: drop `<code>.json` into `src/locales/`, add a
 * matching entry here, and re-run `pnpm build`. The compare-keys CI
 * gate will fail loud if the new locale is missing keys.
 */

export interface LocaleLabel {
  /** English label, e.g. 'Czech'. */
  label: string;
  /** Native label, e.g. 'Čeština'. */
  nativeLabel: string;
  /** Right-to-left rendering required. */
  rtl: boolean;
}

export const localeLabels: Record<string, LocaleLabel> = {
  en: { label: 'English', nativeLabel: 'English', rtl: false },
  fr: { label: 'French', nativeLabel: 'Français', rtl: false },
  es: { label: 'Spanish', nativeLabel: 'Español', rtl: false },
  'pt-BR': { label: 'Portuguese (Brazil)', nativeLabel: 'Português (Brasil)', rtl: false },
  de: { label: 'German', nativeLabel: 'Deutsch', rtl: false },
  ar: { label: 'Arabic', nativeLabel: 'العربية', rtl: true },
  cs: { label: 'Czech', nativeLabel: 'Čeština', rtl: false },
  hr: { label: 'Croatian', nativeLabel: 'Hrvatski', rtl: false },
  'zh-CN': { label: 'Chinese (Simplified)', nativeLabel: '简体中文', rtl: false },
};
