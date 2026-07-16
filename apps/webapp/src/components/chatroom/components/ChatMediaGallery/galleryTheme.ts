import type { CSSProperties } from 'react'

/** Discord-parity lightbox tokens — Off-system media overlay (design-system.md §Media tiles). */
export const galleryLightboxThemeStyle: CSSProperties & Record<`--${string}`, string> = {
  '--gallery-panel-bg': '#111214',
  '--gallery-panel-border': '#1e1f22',
  '--gallery-panel-hover': '#35373c',
  '--gallery-nav-bg': '#1e1f22',
  '--gallery-nav-hover': '#2b2d31',
  '--gallery-text-primary': '#dbdee1',
  '--gallery-text-heading': '#f2f3f5',
  '--gallery-text-muted': '#949ba4',
  '--gallery-text-action': '#b5bac1'
}
