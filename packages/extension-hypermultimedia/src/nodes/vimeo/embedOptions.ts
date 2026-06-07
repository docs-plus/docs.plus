import { FULLSCREEN_IFRAME_DOM_ATTR_KEYS, resolveEmbedOption } from '../../utils/embedKit'

/** Kit defaults and node attrs merged into Vimeo player iframe query params. */

export type VimeoBylinePortrait = boolean | 'site-default'
export type VimeoQuality = '240p' | '360p' | '540p' | '720p' | '1080p' | '2k' | '4k' | 'auto'

export interface VimeoPlayerKitOptions {
  autopause: boolean
  autoplay: boolean
  background: boolean
  byline: VimeoBylinePortrait
  color?: string
  controls: boolean
  dnt: boolean
  keyboard: boolean
  loop: boolean
  muted: boolean
  pip: boolean
  playsinline: boolean
  portrait: VimeoBylinePortrait
  quality: VimeoQuality
  speed: boolean
  texttrack?: string | false
  title: boolean
  transparent: boolean
  endTime?: number
  allow: string
  frameborder: number
  allowfullscreen: boolean
}

type VimeoEmbedParamKey = keyof Pick<
  VimeoPlayerKitOptions,
  | 'autopause'
  | 'autoplay'
  | 'background'
  | 'byline'
  | 'color'
  | 'controls'
  | 'dnt'
  | 'keyboard'
  | 'loop'
  | 'muted'
  | 'pip'
  | 'playsinline'
  | 'portrait'
  | 'quality'
  | 'speed'
  | 'texttrack'
  | 'title'
  | 'transparent'
  | 'endTime'
>

/** Internal keys → query names in [Vimeo embed options](https://developer.vimeo.com/player/sdk/embed). */
const VIMEO_QUERY_PARAM: Record<VimeoEmbedParamKey, string> = {
  autopause: 'autopause',
  autoplay: 'autoplay',
  background: 'background',
  byline: 'byline',
  color: 'color',
  controls: 'controls',
  dnt: 'dnt',
  keyboard: 'keyboard',
  loop: 'loop',
  muted: 'muted',
  pip: 'pip',
  playsinline: 'playsinline',
  portrait: 'portrait',
  quality: 'quality',
  speed: 'speed',
  texttrack: 'texttrack',
  title: 'title',
  transparent: 'transparent',
  endTime: 'end_time'
}

export const VIMEO_PLAYER_KIT_DEFAULTS: VimeoPlayerKitOptions = {
  autopause: true,
  autoplay: false,
  background: false,
  byline: true,
  color: undefined,
  controls: true,
  dnt: false,
  keyboard: true,
  loop: false,
  muted: false,
  pip: true,
  playsinline: true,
  portrait: true,
  quality: 'auto',
  speed: false,
  texttrack: undefined,
  title: true,
  transparent: true,
  endTime: undefined,
  allow: 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media',
  frameborder: 0,
  allowfullscreen: true
}

export const VIMEO_EMBED_ATTR_KEYS = [
  'src',
  'start',
  ...(Object.keys(VIMEO_QUERY_PARAM) as VimeoEmbedParamKey[]),
  ...FULLSCREEN_IFRAME_DOM_ATTR_KEYS
] as const

export const parseVimeoVideoRef = (url: string): { id: string; h?: string } | null => {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./i, '')

    if (host === 'player.vimeo.com') {
      const id = parsed.pathname.match(/\/video\/(\d+)/)?.[1]
      if (!id) return null
      const h = parsed.searchParams.get('h') ?? undefined
      return { id, h }
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.match(/\/(\d+)/)?.[1]
      if (!id) return null
      const h = parsed.searchParams.get('h') ?? undefined
      return { id, h }
    }
  } catch {
    return null
  }

  return null
}

const formatVimeoParam = (value: boolean | string | number): string => {
  if (value === 'site-default') return 'site-default'
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

const normalizeVimeoColor = (color: string): string => color.replace(/^#/, '')

export const buildVimeoEmbedUrl = (
  url: string,
  attrs: Record<string, unknown>,
  options: VimeoPlayerKitOptions
): string | null => {
  const ref = parseVimeoVideoRef(url)
  if (!ref) return null

  const embedUrl = new URL(`https://player.vimeo.com/video/${ref.id}`)
  if (ref.h) embedUrl.searchParams.set('h', ref.h)
  ;(Object.keys(VIMEO_QUERY_PARAM) as VimeoEmbedParamKey[]).forEach((optionKey) => {
    const value = resolveEmbedOption(attrs, options, optionKey)
    if (value === undefined || value === null || value === '') return

    const queryKey = VIMEO_QUERY_PARAM[optionKey]
    if (optionKey === 'color' && typeof value === 'string') {
      embedUrl.searchParams.set(queryKey, normalizeVimeoColor(value))
      return
    }
    embedUrl.searchParams.set(queryKey, formatVimeoParam(value))
  })

  const start = attrs.start
  if (typeof start === 'number' && start > 0) {
    embedUrl.searchParams.set('start_time', String(start))
  }

  const width = attrs.width
  const height = attrs.height
  if (typeof width === 'number' && width > 0) {
    embedUrl.searchParams.set('width', String(width))
  }
  if (typeof height === 'number' && height > 0) {
    embedUrl.searchParams.set('height', String(height))
  }

  return embedUrl.toString()
}
