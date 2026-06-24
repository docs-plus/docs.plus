import { Node, nodePasteRule } from '@tiptap/core'

import { captionAttribute } from '../../caption'
import { createTypedMediaMarkdownHooks } from '../../markdown/typedMediaMarkdown'
import {
  EMBED_BLOCK_LAYOUT_DEFAULTS,
  type EmbedNodeOptions,
  kitAttrDefaults,
  layoutAttrDefaults,
  resolveEmbedLayoutDimensions
} from '../../utils/embedKit'
import {
  createIframeEmbedNodeView,
  defineFullscreenIframeEmbedConfig,
  renderIframeEmbedHTML
} from '../../utils/iframeEmbedNode'
import { generateShortId, type StyleLayoutOptions } from '../../utils/utils'
import {
  buildYoutubeEmbedUrl,
  parseYoutubeStartSeconds,
  YOUTUBE_EMBED_ATTR_KEYS,
  YOUTUBE_PLAYER_KIT_DEFAULTS,
  type YoutubeEmbedColor,
  type YoutubeListType,
  type YoutubePlayerKitOptions
} from './embedOptions'
import { isValidYoutubeUrl, YOUTUBE_REGEX_GLOBAL } from './helper'

export interface YoutubeOptions
  extends StyleLayoutOptions, EmbedNodeOptions, YoutubePlayerKitOptions {}

export type SetYoutubeVideoOptions = {
  src: string
  start?: number
} & StyleLayoutOptions &
  Partial<YoutubePlayerKitOptions>

const YOUTUBE_IFRAME_CONFIG = defineFullscreenIframeEmbedConfig<YoutubeOptions>({
  wrapperClass: 'hypermultimedia--youtube__content',
  dataVideoAttr: 'data-youtube-video',
  renderWrapperClass: 'youtube-video',
  embedAttrKeys: YOUTUBE_EMBED_ATTR_KEYS,
  contentEditableFalse: true,
  loadingProvider: 'YouTube',
  buildEmbedUrl: buildYoutubeEmbedUrl
})

export const Youtube = Node.create<YoutubeOptions>({
  name: 'youtube',
  draggable: true,

  ...createTypedMediaMarkdownHooks('youtube'),

  addOptions() {
    return {
      ...YOUTUBE_PLAYER_KIT_DEFAULTS,
      ...EMBED_BLOCK_LAYOUT_DEFAULTS
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
      src: { default: null },
      start: { default: 0 },
      caption: captionAttribute(),
      ...layoutAttrDefaults(this.options),
      ...kitAttrDefaults(this.options, YOUTUBE_PLAYER_KIT_DEFAULTS)
    }
  },

  addNodeView() {
    return createIframeEmbedNodeView(YOUTUBE_IFRAME_CONFIG, () => ({
      name: this.name,
      options: this.options,
      editor: this.editor
    }))
  },

  parseHTML() {
    return [{ tag: 'div[data-youtube-video] iframe' }]
  },

  addCommands() {
    return {
      setYoutubeVideo:
        (options: SetYoutubeVideoOptions) =>
        ({ commands }) => {
          if (!isValidYoutubeUrl(options.src)) return false

          const startFromUrl = parseYoutubeStartSeconds(options.src)
          const start = options.start ?? (startFromUrl !== undefined ? startFromUrl : 0)
          const { width, height, ...rest } = options
          const layout = resolveEmbedLayoutDimensions(this.editor, { width, height }, this.options)

          return commands.insertContent({
            type: this.name,
            attrs: {
              ...rest,
              ...layout,
              start,
              keyId: generateShortId()
            }
          })
        }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderIframeEmbedHTML(YOUTUBE_IFRAME_CONFIG, this.options, { node, HTMLAttributes })
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return []

    return [
      nodePasteRule({
        find: YOUTUBE_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => {
          const src = match.input?.trim()
          if (!src || !isValidYoutubeUrl(src)) return false

          const start = parseYoutubeStartSeconds(src)

          return {
            src,
            ...(start !== undefined && start > 0 ? { start } : {})
          }
        }
      })
    ]
  }
})

export type { YoutubeEmbedColor, YoutubeListType }
