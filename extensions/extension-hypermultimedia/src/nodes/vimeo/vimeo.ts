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
  buildVimeoEmbedUrl,
  VIMEO_EMBED_ATTR_KEYS,
  VIMEO_PLAYER_KIT_DEFAULTS,
  type VimeoBylinePortrait,
  type VimeoPlayerKitOptions,
  type VimeoQuality
} from './embedOptions'
import { isValidVimeoUrl, VIMEO_REGEX_GLOBAL } from './helper'

export interface VimeoOptions extends StyleLayoutOptions, EmbedNodeOptions, VimeoPlayerKitOptions {}

export type SetVimeoOptions = {
  src: string
  start?: number
} & StyleLayoutOptions &
  Partial<VimeoPlayerKitOptions>

const VIMEO_IFRAME_CONFIG = defineFullscreenIframeEmbedConfig<VimeoOptions>({
  wrapperClass: 'hypermultimedia--vimeo__content',
  dataVideoAttr: 'data-vimeo-video',
  renderWrapperClass: 'vimeo-video',
  embedAttrKeys: VIMEO_EMBED_ATTR_KEYS,
  loadingProvider: 'Vimeo',
  buildEmbedUrl: buildVimeoEmbedUrl
})

export const Vimeo = Node.create<VimeoOptions>({
  name: 'vimeo',
  draggable: true,

  ...createTypedMediaMarkdownHooks('vimeo'),

  addOptions() {
    return {
      ...VIMEO_PLAYER_KIT_DEFAULTS,
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
      ...kitAttrDefaults(this.options, VIMEO_PLAYER_KIT_DEFAULTS)
    }
  },

  addNodeView() {
    return createIframeEmbedNodeView(VIMEO_IFRAME_CONFIG, () => ({
      name: this.name,
      options: this.options,
      editor: this.editor
    }))
  },

  parseHTML() {
    return [{ tag: 'div[data-vimeo-video] iframe' }]
  },

  addCommands() {
    return {
      setVimeo:
        (options: SetVimeoOptions) =>
        ({ commands }) => {
          if (!isValidVimeoUrl(options.src)) return false

          const { width, height, ...rest } = options
          const layout = resolveEmbedLayoutDimensions(this.editor, { width, height }, this.options)

          return commands.insertContent({
            type: this.name,
            attrs: { ...rest, ...layout, keyId: generateShortId() }
          })
        }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderIframeEmbedHTML(VIMEO_IFRAME_CONFIG, this.options, { node, HTMLAttributes })
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return []

    return [
      nodePasteRule({
        find: VIMEO_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => {
          const src = match.input?.trim()
          if (!src || !isValidVimeoUrl(src)) return false
          return { src }
        }
      })
    ]
  }
})

export type { VimeoBylinePortrait, VimeoQuality }
