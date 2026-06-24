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
import { createIframeEmbedNodeView, renderIframeEmbedHTML } from '../../utils/iframeEmbedNode'
import { generateShortId, type StyleLayoutOptions } from '../../utils/utils'
import {
  buildLoomEmbedUrl,
  LOOM_EMBED_ATTR_KEYS,
  LOOM_EMBED_KIT_DEFAULTS,
  type LoomEmbedKitOptions,
  resolveLoomIframeAttributes
} from './embedOptions'
import { getLoomEmbedUrl, isValidLoomUrl, LOOM_REGEX_GLOBAL } from './helper'

export interface LoomOptions extends StyleLayoutOptions, EmbedNodeOptions, LoomEmbedKitOptions {}

export type SetLoomOptions = {
  src: string
} & StyleLayoutOptions &
  Partial<LoomEmbedKitOptions>

const LOOM_IFRAME_CONFIG = {
  wrapperClass: 'hypermultimedia--loom__content',
  dataVideoAttr: 'data-loom-video',
  renderWrapperClass: 'loom-video',
  embedAttrKeys: LOOM_EMBED_ATTR_KEYS,
  loadingProvider: 'Loom',
  buildEmbedUrl: (src: string, attrs: Record<string, unknown>, options: LoomOptions) =>
    buildLoomEmbedUrl(src, attrs, options, getLoomEmbedUrl),
  resolveIframeAttributes: resolveLoomIframeAttributes
} satisfies Parameters<typeof createIframeEmbedNodeView<LoomOptions>>[0]

export const Loom = Node.create<LoomOptions>({
  name: 'loom',
  draggable: true,

  ...createTypedMediaMarkdownHooks('loom'),

  addOptions() {
    return {
      ...LOOM_EMBED_KIT_DEFAULTS,
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
      src: {
        default: null,
        parseHTML: (element) => {
          const src = element.getAttribute('src')
          return src && isValidLoomUrl(src) ? src : null
        }
      },
      caption: captionAttribute(),
      ...layoutAttrDefaults(this.options),
      ...kitAttrDefaults(this.options, LOOM_EMBED_KIT_DEFAULTS)
    }
  },

  addNodeView() {
    return createIframeEmbedNodeView(LOOM_IFRAME_CONFIG, () => ({
      name: this.name,
      options: this.options,
      editor: this.editor
    }))
  },

  parseHTML() {
    return [{ tag: 'div[data-loom-video] iframe' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderIframeEmbedHTML(LOOM_IFRAME_CONFIG, this.options, { node, HTMLAttributes })
  },

  addCommands() {
    return {
      setLoom:
        (options: SetLoomOptions) =>
        ({ commands }) => {
          if (!isValidLoomUrl(options.src)) return false

          const { width, height, ...rest } = options
          const layout = resolveEmbedLayoutDimensions(this.editor, { width, height }, this.options)

          return commands.insertContent({
            type: this.name,
            attrs: { ...rest, ...layout, keyId: generateShortId() }
          })
        }
    }
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return []

    return [
      nodePasteRule({
        find: LOOM_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => {
          const src = match.input?.trim()
          if (!src || !isValidLoomUrl(src)) return false
          return { src }
        }
      })
    ]
  }
})

export type { LoomEmbedKitOptions }
