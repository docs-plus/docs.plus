import type { MermaidTheme } from '../types'

const THEME_VARS: [key: Exclude<keyof MermaidTheme, 'series'>, name: string][] = [
  ['background', '--pele-bg'],
  ['foreground', '--pele-fg'],
  ['muted', '--pele-muted'],
  ['line', '--pele-line'],
  ['surface', '--pele-surface'],
  ['surfaceAlt', '--pele-surface-alt'],
  ['border', '--pele-border'],
  ['accent', '--pele-accent'],
  ['critical', '--pele-critical'],
  ['fontFamily', '--pele-font'],
  ['fontFamilyMono', '--pele-font-mono'],
  ['radius', '--pele-radius']
]

export function applyTheme(dom: HTMLElement, theme: MermaidTheme | null): void {
  if (!theme) return
  for (const [key, name] of THEME_VARS) {
    const value = theme[key]
    if (value !== undefined) dom.style.setProperty(name, value)
  }
  theme.series?.slice(0, 8).forEach((color, i) => {
    dom.style.setProperty(`--pele-series-${i + 1}`, color)
  })
}
