import { resolveEmbedOption, SOUNDCLOUD_IFRAME_DOM_ATTR_KEYS } from '../../utils/embedKit'

/** SoundCloud HTML5 widget params — [widget docs](https://developers.soundcloud.com/docs/api/html5-widget). */

export interface SoundCloudPlayerKitOptions {
  auto_play: boolean
  hide_related: boolean
  show_comments: boolean
  show_user: boolean
  show_reposts: boolean
  visual: boolean
  color?: string
  buying: boolean
  sharing: boolean
  download: boolean
  show_artwork: boolean
  show_playcount: boolean
  start_track?: number
  single_active: boolean
  scrolling: string
  frameborder: string
  allow: string
}

export const SOUNDCLOUD_WIDGET_PARAM_KEYS = [
  'auto_play',
  'hide_related',
  'show_comments',
  'show_user',
  'show_reposts',
  'color',
  'buying',
  'sharing',
  'download',
  'show_artwork',
  'show_playcount',
  'start_track',
  'single_active'
] as const satisfies readonly (keyof SoundCloudPlayerKitOptions)[]

export const SOUNDCLOUD_VISUAL_PLAYER_MIN_HEIGHT = 130

export const SOUNDCLOUD_EMBED_ATTR_KEYS = [
  'src',
  'height',
  ...SOUNDCLOUD_WIDGET_PARAM_KEYS,
  'visual',
  ...SOUNDCLOUD_IFRAME_DOM_ATTR_KEYS
] as const

export const SOUNDCLOUD_PLAYER_KIT_DEFAULTS: SoundCloudPlayerKitOptions = {
  auto_play: false,
  hide_related: false,
  show_comments: true,
  show_user: true,
  show_reposts: true,
  visual: false,
  color: undefined,
  buying: true,
  sharing: true,
  download: true,
  show_artwork: true,
  show_playcount: true,
  start_track: undefined,
  single_active: true,
  scrolling: 'no',
  frameborder: 'no',
  allow: 'autoplay'
}

const formatWidgetValue = (value: boolean | number | string): string => {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

/** Heights above ~130px use the visual (waveform) player unless `visual` is set explicitly. */
export const resolveSoundCloudVisual = (
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions
): boolean => {
  if (attrs.visual !== null && attrs.visual !== undefined) {
    return Boolean(attrs.visual)
  }
  const height = attrs.height
  if (typeof height === 'number' && height > SOUNDCLOUD_VISUAL_PLAYER_MIN_HEIGHT) return true
  return options.visual
}

export const buildSoundCloudEmbedUrl = (
  trackUrl: string,
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions
): string => {
  const embedUrl = new URL('https://w.soundcloud.com/player/')
  embedUrl.searchParams.set('url', trackUrl.trim())

  SOUNDCLOUD_WIDGET_PARAM_KEYS.forEach((key) => {
    const value = resolveEmbedOption(attrs, options, key)
    if (value === undefined || value === null || value === '') return
    embedUrl.searchParams.set(key, formatWidgetValue(value))
  })

  embedUrl.searchParams.set('visual', formatWidgetValue(resolveSoundCloudVisual(attrs, options)))

  return embedUrl.toString()
}

export const resolveSoundCloudIframeAttributes = (
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions,
  width: number,
  height: number
): Record<string, string | number> => ({
  width,
  height,
  scrolling: String(resolveEmbedOption(attrs, options, 'scrolling') ?? options.scrolling),
  frameborder: String(resolveEmbedOption(attrs, options, 'frameborder') ?? options.frameborder),
  allow: String(resolveEmbedOption(attrs, options, 'allow') ?? options.allow)
})
