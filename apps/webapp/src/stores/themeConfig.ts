// Zero-dependency theme classification — the single source shared by the Zustand
// store (client) and the pre-hydration FOUC script in `_document.tsx` (SSR). Keep it
// free of `zustand`/React imports so `_document` can pull the data without bundling them.

/** User preference — what they chose in Settings → Appearance. */
export type ThemePreference =
  | 'light'
  | 'dark'
  | 'dark-hc'
  | 'graphite-light'
  | 'graphite-dark'
  | 'paper-light'
  | 'paper-dark'
  | 'system'

/** Resolved daisyUI theme name applied to `data-theme`. */
export type ResolvedTheme =
  | 'docsplus'
  | 'docsplus-dark'
  | 'docsplus-dark-hc'
  | 'docsplus-graphite'
  | 'docsplus-graphite-dark'
  | 'docsplus-paper'
  | 'docsplus-paper-dark'

/** Light resolved themes — the single source for every "is this light?" test. */
export const LIGHT_RESOLVED_THEMES = new Set<ResolvedTheme>([
  'docsplus',
  'docsplus-graphite',
  'docsplus-paper'
])

/** True when the resolved theme is a light one. Dark = everything else (incl. HC). */
export function isLightTheme(resolved: ResolvedTheme): boolean {
  return LIGHT_RESOLVED_THEMES.has(resolved)
}

/** Preference → resolved theme for every explicit (non-`system`) choice.
    Total over the non-system keys so a new preference must be mapped (or it won't compile). */
export const PREFERENCE_TO_THEME: Record<Exclude<ThemePreference, 'system'>, ResolvedTheme> = {
  light: 'docsplus',
  dark: 'docsplus-dark',
  'dark-hc': 'docsplus-dark-hc',
  'graphite-light': 'docsplus-graphite',
  'graphite-dark': 'docsplus-graphite-dark',
  'paper-light': 'docsplus-paper',
  'paper-dark': 'docsplus-paper-dark'
}

/** Resolve a preference + OS setting into a concrete theme name. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return PREFERENCE_TO_THEME[preference]

  // "system" — follow OS; system only ever picks the base light/dark pair.
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'docsplus-dark'
  }
  return 'docsplus'
}

/** Apply the resolved theme to the DOM. daisyUI sets `color-scheme` per theme, so dark-scoped
    CSS resolves via `light-dark()` off `data-theme` alone — no companion attribute needed. */
export function applyThemeToDom(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolved)
}
