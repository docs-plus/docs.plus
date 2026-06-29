import type { Editor } from '@tiptap/core'

import { syncResponsiveMediaHost } from '../../loading/syncLayout'
import { resolveEmbedOption, SOUNDCLOUD_IFRAME_DOM_ATTR_KEYS } from '../../utils/embedKit'
import { fitLayoutToEditorColumn } from '../../utils/fitImageDimensions'

/** Page URL or `w.soundcloud.com/player/?url=…` from serialized HTML → canonical track URL. */
export function parseSoundCloudTrackUrl(url: string): string | null {
  try {
    const trimmed = url.trim()
    if (!trimmed) return null

    const parsed = new URL(trimmed)
    const host = parsed.hostname.replace(/^www\./i, '')

    if (host === 'w.soundcloud.com') {
      const track = parsed.searchParams.get('url')
      return track ? decodeURIComponent(track) : null
    }

    if (host === 'soundcloud.com') return trimmed
  } catch {
    return null
  }

  return null
}

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

/** Compact widget chrome needs ~120px; visual waveform player needs ~166px. */
export const SOUNDCLOUD_COMPACT_PLAYER_MIN_HEIGHT = 120
export const SOUNDCLOUD_VISUAL_PLAYER_LAYOUT_MIN_HEIGHT = 166

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

function formatWidgetValue(value: boolean | number | string): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

/** Heights above ~130px use the visual (waveform) player unless `visual` is set explicitly. */
export function resolveSoundCloudVisual(
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions
): boolean {
  if (attrs.visual != null) return Boolean(attrs.visual)
  const height = attrs.height
  if (typeof height === 'number' && height > SOUNDCLOUD_VISUAL_PLAYER_MIN_HEIGHT) return true
  return options.visual
}

export function resolveSoundCloudLayoutMinHeight(
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions
): number {
  return resolveSoundCloudVisual(attrs, options)
    ? SOUNDCLOUD_VISUAL_PLAYER_LAYOUT_MIN_HEIGHT
    : SOUNDCLOUD_COMPACT_PLAYER_MIN_HEIGHT
}

export function resolveSoundCloudExtensionOptions(editor: Editor): SoundCloudPlayerKitOptions {
  const extension = editor.extensionManager.extensions.find((e) => e.name === 'soundcloud')
  return (
    (extension?.options as SoundCloudPlayerKitOptions | undefined) ?? SOUNDCLOUD_PLAYER_KIT_DEFAULTS
  )
}

/** Scale layout down when width exceeds the column; never shrink below widget minimum height. */
export function fitSoundCloudLayoutToEditorColumn(
  editor: Editor,
  width: number,
  height: number,
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions
): { width: number; height: number } {
  const fitted = fitLayoutToEditorColumn(editor, width, height)
  const minHeight = resolveSoundCloudLayoutMinHeight({ ...attrs, height: fitted.height }, options)
  return fitted.height >= minHeight ? fitted : { ...fitted, height: minHeight }
}

/** SoundCloud iframe UI does not scale — floor host height when the column shrinks width. */
export function syncSoundCloudResponsiveHost(
  el: HTMLElement,
  width: number,
  height: number,
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions
): void {
  const hostHeight = Math.max(height, resolveSoundCloudLayoutMinHeight(attrs, options))
  syncResponsiveMediaHost(el, width, hostHeight)
  el.style.minHeight = `${hostHeight}px`
}

export function buildSoundCloudEmbedUrl(
  trackUrl: string,
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions
): string {
  const canonical = parseSoundCloudTrackUrl(trackUrl) ?? trackUrl.trim()
  const embedUrl = new URL('https://w.soundcloud.com/player/')
  embedUrl.searchParams.set('url', canonical)

  for (const key of SOUNDCLOUD_WIDGET_PARAM_KEYS) {
    const value = resolveEmbedOption(attrs, options, key)
    if (value == null || value === '') continue
    embedUrl.searchParams.set(key, formatWidgetValue(value))
  }

  embedUrl.searchParams.set('visual', formatWidgetValue(resolveSoundCloudVisual(attrs, options)))
  return embedUrl.toString()
}

export function resolveSoundCloudIframeAttributes(
  attrs: Record<string, unknown>,
  options: SoundCloudPlayerKitOptions,
  width: number,
  height: number
): Record<string, string | number> {
  return {
    width,
    height,
    scrolling: String(resolveEmbedOption(attrs, options, 'scrolling') ?? options.scrolling),
    frameborder: String(resolveEmbedOption(attrs, options, 'frameborder') ?? options.frameborder),
    allow: String(resolveEmbedOption(attrs, options, 'allow') ?? options.allow)
  }
}
