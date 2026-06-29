import { Node, nodePasteRule } from '@tiptap/core'

import { captionAttribute } from '../../caption'
import { createTypedMediaMarkdownHooks } from '../../markdown/typedMediaMarkdown'
import {
  EMBED_BLOCK_LAYOUT_DEFAULTS,
  type EmbedNodeOptions,
  kitAttrDefaults,
  layoutAttrDefaults
} from '../../utils/embedKit'
import {
  createIframeEmbedNodeView,
  defineFullscreenIframeEmbedConfig,
  type IframeEmbedConfig,
  renderIframeEmbedHTML
} from '../../utils/iframeEmbedNode'
import { generateShortId, type StyleLayoutOptions } from '../../utils/utils'
import {
  buildSpotifyEmbedUrl,
  canonicalSpotifyUrl,
  defaultSpotifyHeight,
  fitSpotifyLayoutToEditorColumn,
  parseSpotifyEntity,
  SPOTIFY_DEFAULT_WIDTH,
  SPOTIFY_EMBED_ATTR_KEYS,
  SPOTIFY_EMBED_KIT_DEFAULTS,
  SPOTIFY_FULL_HEIGHT,
  type SpotifyEmbedKitOptions,
  syncSpotifyResponsiveHost
} from './embedOptions'
import { SPOTIFY_EMBED_IFRAME_REGEX, SPOTIFY_URL_REGEX_GLOBAL } from './helper'

export interface SpotifyOptions
  extends StyleLayoutOptions, EmbedNodeOptions, SpotifyEmbedKitOptions {}

export type SetSpotifyOptions = {
  src: string
} & StyleLayoutOptions &
  Partial<SpotifyEmbedKitOptions>

const SPOTIFY_IFRAME_CONFIG: IframeEmbedConfig<SpotifyOptions> = {
  ...defineFullscreenIframeEmbedConfig<SpotifyOptions>({
    wrapperClass: 'hypermultimedia--spotify__content',
    dataVideoAttr: 'data-spotify-media',
    renderWrapperClass: 'spotify-media',
    embedAttrKeys: SPOTIFY_EMBED_ATTR_KEYS,
    loadingProvider: 'Spotify',
    buildEmbedUrl: buildSpotifyEmbedUrl
  }),
  // Spotify's player is fixed-height: pin the host instead of aspect-scaling it.
  syncLoadingHost: syncSpotifyResponsiveHost
}

/** Keep an integer px dimension, else null → schema default (bare embed iframes use `width="100%"`). */
const integerPxAttr = (raw: string | null): number | null => {
  const px = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(px) && String(px) === raw ? px : null
}

export const Spotify = Node.create<SpotifyOptions>({
  name: 'spotify',
  draggable: true,

  ...createTypedMediaMarkdownHooks('spotify'),

  addOptions() {
    return {
      ...SPOTIFY_EMBED_KIT_DEFAULTS,
      ...EMBED_BLOCK_LAYOUT_DEFAULTS,
      width: SPOTIFY_DEFAULT_WIDTH,
      height: SPOTIFY_FULL_HEIGHT
    }
  },

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  addAttributes() {
    return {
      keyId: { default: null },
      src: {
        default: null,
        // Serialized iframes carry the `embed/` URL; normalize back to the canonical share URL.
        parseHTML: (element) => {
          const entity = parseSpotifyEntity(element.getAttribute('src') ?? '')
          return entity ? canonicalSpotifyUrl(entity) : null
        }
      },
      caption: captionAttribute(),
      ...layoutAttrDefaults(this.options),
      // Tiptap auto-reads (and merge-wins) a bare embed iframe's `width="100%"` over a
      // parse rule's getAttrs → a 100px sliver; sanitize both dims to an integer or the default.
      width: {
        default: this.options.width,
        parseHTML: (el) => integerPxAttr(el.getAttribute('width'))
      },
      height: {
        default: this.options.height,
        parseHTML: (el) => integerPxAttr(el.getAttribute('height'))
      },
      ...kitAttrDefaults(this.options, SPOTIFY_EMBED_KIT_DEFAULTS)
    }
  },

  addNodeView() {
    return createIframeEmbedNodeView(SPOTIFY_IFRAME_CONFIG, () => ({
      name: this.name,
      options: this.options,
      editor: this.editor
    }))
  },

  parseHTML() {
    return [
      { tag: 'div[data-spotify-media] iframe' },
      {
        // Pasted/imported "Copy embed" iframe (bare, no wrapper div).
        tag: 'iframe[src*="open.spotify.com/embed"]',
        getAttrs: (node: string | HTMLElement) =>
          typeof node !== 'string' && parseSpotifyEntity(node.getAttribute('src') ?? '')
            ? {}
            : false
      }
    ]
  },

  addCommands() {
    return {
      setSpotify:
        (options: SetSpotifyOptions) =>
        ({ commands }) => {
          const entity = parseSpotifyEntity(options.src)
          if (!entity) return false

          const { width, height, ...rest } = options
          const layout = fitSpotifyLayoutToEditorColumn(
            this.editor,
            Number(width ?? this.options.width),
            Number(height ?? defaultSpotifyHeight(entity.type))
          )

          return commands.insertContent({
            type: this.name,
            attrs: { ...rest, ...layout, keyId: generateShortId() }
          })
        }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderIframeEmbedHTML(SPOTIFY_IFRAME_CONFIG, this.options, { node, HTMLAttributes })
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return []

    return [
      nodePasteRule({
        find: SPOTIFY_URL_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => {
          const src = match.input?.trim()
          const entity = src ? parseSpotifyEntity(src) : null
          if (!src || !entity) return false
          return { src, height: defaultSpotifyHeight(entity.type) }
        }
      }),
      // Pasting the "Copy embed" iframe markup (plain text) — pull out the embed URL.
      nodePasteRule({
        find: SPOTIFY_EMBED_IFRAME_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const entity = parseSpotifyEntity(match[1] ?? '')
          if (!entity) return false
          return { src: canonicalSpotifyUrl(entity), height: defaultSpotifyHeight(entity.type) }
        }
      })
    ]
  }
})
