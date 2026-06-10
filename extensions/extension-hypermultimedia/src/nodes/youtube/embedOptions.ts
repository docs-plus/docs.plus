import { FULLSCREEN_IFRAME_DOM_ATTR_KEYS, resolveEmbedOption } from '../../utils/embedKit'

/** Kit defaults and node attrs merged into official YouTube iframe query params. */

export type YoutubeEmbedColor = 'red' | 'white'
export type YoutubeListType = 'playlist' | 'user_uploads'

export interface YoutubePlayerKitOptions {
  autoplay: 0 | 1
  ccLanguage?: string
  ccLoadPolicy?: 0 | 1
  color?: YoutubeEmbedColor
  controls: 0 | 1
  disableKBcontrols: 0 | 1
  enableIFrameApi: 0 | 1
  endTime?: number
  fs: 0 | 1
  interfaceLanguage?: string
  ivLoadPolicy: 1 | 3
  loop: 0 | 1
  modestbranding: 0 | 1
  nocookie: boolean
  origin?: string
  playlist?: string
  playsinline: 0 | 1
  rel: 0 | 1
  list?: string
  listType?: YoutubeListType
  allow: string
  frameborder: number
  allowfullscreen: boolean
}

type YoutubeEmbedParamKey = keyof Pick<
  YoutubePlayerKitOptions,
  | 'autoplay'
  | 'ccLanguage'
  | 'ccLoadPolicy'
  | 'color'
  | 'controls'
  | 'disableKBcontrols'
  | 'enableIFrameApi'
  | 'endTime'
  | 'fs'
  | 'interfaceLanguage'
  | 'ivLoadPolicy'
  | 'loop'
  | 'modestbranding'
  | 'origin'
  | 'playlist'
  | 'playsinline'
  | 'rel'
  | 'list'
  | 'listType'
>

/** Internal option keys → query names documented by YouTube. */
const YOUTUBE_QUERY_PARAM: Record<YoutubeEmbedParamKey, string> = {
  autoplay: 'autoplay',
  ccLanguage: 'cc_lang_pref',
  ccLoadPolicy: 'cc_load_policy',
  color: 'color',
  controls: 'controls',
  disableKBcontrols: 'disablekb',
  enableIFrameApi: 'enablejsapi',
  endTime: 'end',
  fs: 'fs',
  interfaceLanguage: 'hl',
  ivLoadPolicy: 'iv_load_policy',
  loop: 'loop',
  modestbranding: 'modestbranding',
  origin: 'origin',
  playlist: 'playlist',
  playsinline: 'playsinline',
  rel: 'rel',
  list: 'list',
  listType: 'listType'
}

export const YOUTUBE_PLAYER_KIT_DEFAULTS: YoutubePlayerKitOptions = {
  autoplay: 0,
  ccLanguage: undefined,
  ccLoadPolicy: undefined,
  color: undefined,
  controls: 1,
  disableKBcontrols: 0,
  enableIFrameApi: 0,
  endTime: undefined,
  fs: 1,
  interfaceLanguage: undefined,
  ivLoadPolicy: 1,
  loop: 0,
  modestbranding: 0,
  nocookie: false,
  origin: undefined,
  playlist: undefined,
  playsinline: 0,
  rel: 1,
  list: undefined,
  listType: undefined,
  allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
  frameborder: 0,
  allowfullscreen: true
}

export const parseYoutubeVideoId = (url: string): string | null => {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./i, '')

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ?? null
    }

    // Exact-host match only: `includes` would accept youtube.com.evil.example.
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] ?? null
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/')[2] ?? null
      }
      const fromQuery = parsed.searchParams.get('v')
      if (fromQuery) return fromQuery
    }
  } catch {
    return null
  }

  return null
}

/** Reads `t`, `start`, or `#t=` from a pasted watch URL (seconds). */
export const parseYoutubeStartSeconds = (url: string): number | undefined => {
  try {
    const parsed = new URL(url.trim())
    const startParam = parsed.searchParams.get('start') ?? parsed.searchParams.get('t')
    if (startParam) {
      const asNumber = Number(startParam)
      if (!Number.isNaN(asNumber)) return asNumber
    }
    const hashMatch = parsed.hash.match(/t=(\d+)/)
    if (hashMatch?.[1]) return Number(hashMatch[1])
  } catch {
    return undefined
  }
  return undefined
}

export const getYoutubeEmbedHost = (nocookie: boolean): string =>
  nocookie ? 'https://www.youtube-nocookie.com/embed/' : 'https://www.youtube.com/embed/'

export const YOUTUBE_EMBED_ATTR_KEYS = [
  'src',
  'start',
  'nocookie',
  ...(Object.keys(YOUTUBE_QUERY_PARAM) as YoutubeEmbedParamKey[]),
  ...FULLSCREEN_IFRAME_DOM_ATTR_KEYS
] as const

export const buildYoutubeEmbedUrl = (
  url: string,
  attrs: Record<string, unknown>,
  options: YoutubePlayerKitOptions
): string | null => {
  const videoId = parseYoutubeVideoId(url)
  if (!videoId) return null

  const nocookie = Boolean(resolveEmbedOption(attrs, options, 'nocookie'))
  const embedUrl = new URL(`${getYoutubeEmbedHost(nocookie)}${videoId}`)

  const appendParam = (queryKey: string, value: string | number) => {
    embedUrl.searchParams.set(queryKey, String(value))
  }

  ;(Object.keys(YOUTUBE_QUERY_PARAM) as YoutubeEmbedParamKey[]).forEach((optionKey) => {
    const value = resolveEmbedOption(attrs, options, optionKey)
    if (value === undefined || value === null || value === '') return
    appendParam(YOUTUBE_QUERY_PARAM[optionKey], value)
  })

  const startAttr = attrs.start
  if (typeof startAttr === 'number' && startAttr > 0) {
    appendParam('start', startAttr)
  }

  const loop = resolveEmbedOption(attrs, options, 'loop') ?? 0
  if (loop === 1 && !embedUrl.searchParams.has('playlist')) {
    appendParam('playlist', videoId)
  }

  return embedUrl.toString()
}
