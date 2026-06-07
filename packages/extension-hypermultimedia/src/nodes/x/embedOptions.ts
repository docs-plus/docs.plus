export type XEmbedSizeId = 'compact' | 'standard' | 'wide'
export type XEmbedTheme = 'light' | 'dark'

export const X_EMBED_DEFAULT_MAXWIDTH = 400

export const X_EMBED_SIZE_OPTIONS: ReadonlyArray<{
  id: XEmbedSizeId
  label: string
  maxwidth: number
}> = [
  { id: 'compact', label: 'Compact', maxwidth: 280 },
  { id: 'standard', label: 'Standard', maxwidth: 400 },
  { id: 'wide', label: 'Wide', maxwidth: 550 }
]

export const X_EMBED_THEME_OPTIONS: ReadonlyArray<{ id: XEmbedTheme; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

export const resolveXEmbedSizeId = (maxwidth: number | null | undefined): XEmbedSizeId => {
  const width = maxwidth ?? X_EMBED_DEFAULT_MAXWIDTH
  return X_EMBED_SIZE_OPTIONS.find((option) => option.maxwidth === width)?.id ?? 'standard'
}

export interface XOEmbedKitOptions {
  theme: XEmbedTheme
  lang: string
  dnt: boolean
  hide_media: boolean
  hide_thread: boolean
}

export const buildXOEmbedParams = (
  attrs: Record<string, unknown>,
  options: XOEmbedKitOptions
): Record<string, string | number> => {
  const params: Record<string, string | number> = {
    url: String(attrs.src ?? ''),
    theme: (attrs.theme as XEmbedTheme | undefined) ?? options.theme,
    maxwidth: Number(attrs.maxwidth ?? X_EMBED_DEFAULT_MAXWIDTH),
    lang: String(attrs.lang ?? options.lang),
    dnt: attrs.dnt === false ? 0 : 1,
    omit_script: 1
  }

  if (attrs.hide_media ?? options.hide_media) {
    params.hide_media = 1
  }

  if (attrs.hide_thread ?? options.hide_thread) {
    params.hide_thread = 1
  }

  if (typeof attrs.align === 'string' && attrs.align !== 'none') {
    params.align = attrs.align
  }

  return params
}
