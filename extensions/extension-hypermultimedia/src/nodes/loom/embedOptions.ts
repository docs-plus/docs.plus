import {
  FULLSCREEN_IFRAME_DOM_ATTR_KEYS,
  resolveEmbedOption,
  resolveFullscreenIframeAttributes
} from '../../utils/embedKit'

export interface LoomEmbedKitOptions {
  autoplay: 0 | 1
  muted: 0 | 1
  hideOwner: boolean
  hideShare: boolean
  hideTitle: boolean
  hideEmbedTopBar: boolean
  allow: string
  frameborder: number
  allowfullscreen: boolean
  scrolling: string
}

type LoomEmbedParamKey = keyof Pick<
  LoomEmbedKitOptions,
  'autoplay' | 'muted' | 'hideOwner' | 'hideShare' | 'hideTitle' | 'hideEmbedTopBar'
>

const LOOM_QUERY_PARAM: Record<LoomEmbedParamKey, string> = {
  autoplay: 'autoplay',
  muted: 'muted',
  hideOwner: 'hide_owner',
  hideShare: 'hide_share',
  hideTitle: 'hide_title',
  hideEmbedTopBar: 'hideEmbedTopBar'
}

const LOOM_EMBED_PARAM_KEYS = Object.keys(LOOM_QUERY_PARAM) as LoomEmbedParamKey[]

export const LOOM_EMBED_KIT_DEFAULTS: LoomEmbedKitOptions = {
  autoplay: 0,
  muted: 0,
  hideOwner: false,
  hideShare: false,
  hideTitle: false,
  hideEmbedTopBar: false,
  allow: 'fullscreen; picture-in-picture',
  frameborder: 0,
  allowfullscreen: true,
  scrolling: 'no'
}

export const LOOM_IFRAME_DOM_ATTR_KEYS = ['scrolling', ...FULLSCREEN_IFRAME_DOM_ATTR_KEYS] as const

export const LOOM_EMBED_ATTR_KEYS = [
  'src',
  ...LOOM_EMBED_PARAM_KEYS,
  ...LOOM_IFRAME_DOM_ATTR_KEYS
] as const

export const buildLoomEmbedUrl = (
  url: string,
  attrs: Record<string, unknown>,
  options: LoomEmbedKitOptions,
  normalize: (input: string) => string | null
): string | null => {
  const base = normalize(url)
  if (!base) return null

  const embedUrl = new URL(base)

  for (const optionKey of LOOM_EMBED_PARAM_KEYS) {
    const value = resolveEmbedOption(attrs, options, optionKey)
    if (value === undefined || value === null) continue

    const formatted =
      optionKey === 'autoplay' || optionKey === 'muted' ? String(value) : value ? 'true' : 'false'
    embedUrl.searchParams.set(LOOM_QUERY_PARAM[optionKey], formatted)
  }

  return embedUrl.toString()
}

export const resolveLoomIframeAttributes = (
  attrs: Record<string, unknown>,
  options: LoomEmbedKitOptions,
  width: number,
  height: number
): Record<string, string | number | boolean> => ({
  ...resolveFullscreenIframeAttributes(attrs, options, width, height),
  scrolling: String(resolveEmbedOption(attrs, options, 'scrolling') ?? options.scrolling)
})
