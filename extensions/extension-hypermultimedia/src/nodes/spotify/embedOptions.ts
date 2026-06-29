import type { Editor } from '@tiptap/core'

import { syncResponsiveMediaHost } from '../../loading/syncLayout'
import {
  FULLSCREEN_IFRAME_DOM_ATTR_KEYS,
  type FullscreenIframeKitOptions,
  resolveEmbedOption
} from '../../utils/embedKit'
import { fitLayoutToEditorColumn } from '../../utils/fitImageDimensions'

/** Embeddable Spotify entities — the `{type}` segment of an `open.spotify.com` URL. */
export type SpotifyEntityType = 'track' | 'album' | 'playlist' | 'artist' | 'show' | 'episode'

export const SPOTIFY_ENTITY_TYPES = [
  'track',
  'album',
  'playlist',
  'artist',
  'show',
  'episode'
] as const satisfies readonly SpotifyEntityType[]

/** Spotify's two embed themes — `0` dark (default), `1` light. No other values exist. */
export type SpotifyTheme = 0 | 1

const SPOTIFY_ID = /^[A-Za-z0-9]+$/

const isSpotifyEntityType = (value: string): value is SpotifyEntityType =>
  (SPOTIFY_ENTITY_TYPES as readonly string[]).includes(value)

/**
 * Resolve a Spotify share URL or `spotify:` URI to its `{ type, id }`, or null.
 * Accepts `open.spotify.com/{type}/{id}`, localized `intl-xx`, already-`embed`
 * paths, and `spotify:type:id` URIs; rejects every other host (exact match).
 */
export const parseSpotifyEntity = (
  input: string
): { type: SpotifyEntityType; id: string } | null => {
  const trimmed = input.trim()
  if (!trimmed) return null

  const uri = /^spotify:(track|album|playlist|artist|show|episode):([A-Za-z0-9]+)$/.exec(trimmed)
  if (uri) return { type: uri[1] as SpotifyEntityType, id: uri[2] }

  try {
    const url = new URL(trimmed)
    if (url.hostname.replace(/^www\./i, '') !== 'open.spotify.com') return null

    const segments = url.pathname.split('/').filter(Boolean)
    let i = 0
    if (segments[i] === 'embed') i += 1
    if (segments[i]?.startsWith('intl-')) i += 1

    const type = segments[i]
    const id = segments[i + 1]
    if (!type || !id || !isSpotifyEntityType(type) || !SPOTIFY_ID.test(id)) return null
    return { type, id }
  } catch {
    return null
  }
}

/** Canonical share URL for an entity — the stored `src`, without `/embed` or query. */
export const canonicalSpotifyUrl = (entity: { type: SpotifyEntityType; id: string }): string =>
  `https://open.spotify.com/${entity.type}/${entity.id}`

export interface SpotifyEmbedKitOptions extends FullscreenIframeKitOptions {
  /** `0` dark / `1` light. Unset uses Spotify's default (dark). */
  theme?: SpotifyTheme
}

export const SPOTIFY_DEFAULT_WIDTH = 640
/** Full-art player (album / playlist / artist / show / episode). */
export const SPOTIFY_FULL_HEIGHT = 352
/** Compact single-track player. */
export const SPOTIFY_TRACK_HEIGHT = 152

/** Spotify's generator uses the compact height for tracks and the full-art height for everything else. */
export const defaultSpotifyHeight = (type: SpotifyEntityType): number =>
  type === 'track' ? SPOTIFY_TRACK_HEIGHT : SPOTIFY_FULL_HEIGHT

export const SPOTIFY_EMBED_KIT_DEFAULTS: SpotifyEmbedKitOptions = {
  theme: undefined,
  allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
  frameborder: 0,
  allowfullscreen: true
}

export const SPOTIFY_EMBED_ATTR_KEYS = ['src', 'theme', ...FULLSCREEN_IFRAME_DOM_ATTR_KEYS] as const

export const buildSpotifyEmbedUrl = (
  src: string,
  attrs: Record<string, unknown>,
  options: SpotifyEmbedKitOptions
): string | null => {
  const entity = parseSpotifyEntity(src)
  if (!entity) return null

  const embedUrl = new URL(`https://open.spotify.com/embed/${entity.type}/${entity.id}`)
  embedUrl.searchParams.set('utm_source', 'generator')

  const theme = resolveEmbedOption(attrs, options, 'theme')
  if (theme !== undefined) {
    embedUrl.searchParams.set('theme', String(theme))
  }

  return embedUrl.toString()
}

/** The player has a fixed height and reflows by width — fit width to the column, keep the height. */
export const fitSpotifyLayoutToEditorColumn = (
  editor: Editor,
  width: number,
  height: number
): { width: number; height: number } => {
  const fitted = fitLayoutToEditorColumn(editor, width, height)
  return { width: fitted.width, height }
}

/** Spotify's player UI does not scale — pin host height so a narrow column never squashes it. */
export const syncSpotifyResponsiveHost = (el: HTMLElement, width: number, height: number): void => {
  syncResponsiveMediaHost(el, width, height)
  el.style.minHeight = `${height}px`
}
