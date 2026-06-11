import { Node, nodePasteRule } from '@tiptap/core'

import {
  captionAttribute,
  type CaptionHandle,
  createCaptionElement,
  readCaption
} from '../../caption'
import { layoutAttrsChanged, wrapMediaWithLoadingShell } from '../../loading'
import {
  defaultsFromOptions,
  EMBED_CHROME_DEFAULTS,
  embedAttrsEqual,
  type EmbedNodeOptions
} from '../../utils/embedKit'
import { ignoreNodeViewSubtreeMutation } from '../../utils/ignoreNodeViewMutation'
import { applyStyles, generateShortId, type StyleLayoutOptions } from '../../utils/utils'
import {
  buildXOEmbedParams,
  X_EMBED_DEFAULT_MAXWIDTH,
  type XEmbedTheme,
  type XOEmbedKitOptions
} from './embedOptions'
import { mountXEmbed, normalizeXUrl, watchXEmbedHeight, X_URL_REGEX_GLOBAL } from './helper'

const EMBED_ATTR_KEYS = ['src', 'maxwidth', 'theme', 'lang', 'hide_media', 'hide_thread'] as const

/** oEmbed params seeded from kit options; per-node attrs override them. */
const X_OEMBED_ATTR_KEYS = ['theme', 'lang', 'hide_media', 'hide_thread', 'dnt'] as const

/** Wrapper placement attrs; update() re-applies layout in place when they change. */
const X_CHROME_ATTR_KEYS = ['display', 'float', 'clear', 'margin', 'justifyContent'] as const

export interface XOptions extends StyleLayoutOptions, EmbedNodeOptions, XOEmbedKitOptions {}

export type AddXOptions = {
  src: string
  maxwidth?: number
  theme?: XEmbedTheme
  lang?: string
  hide_media?: boolean
  hide_thread?: boolean
} & StyleLayoutOptions

export const X = Node.create<XOptions>({
  name: 'x',
  draggable: true,
  // Above StarterKit's default (100) so `blockquote.twitter-tweet` parses as an X
  // embed before the generic blockquote rule claims it.
  priority: 101,

  addOptions() {
    return {
      theme: 'light' as XEmbedTheme,
      lang: 'en',
      dnt: true,
      hide_media: false,
      hide_thread: false,
      ...EMBED_CHROME_DEFAULTS
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
      keyId: {
        default: null
      },
      src: {
        default: null
      },
      maxwidth: {
        default: X_EMBED_DEFAULT_MAXWIDTH
      },
      align: {
        default: null
      },
      ...defaultsFromOptions(this.options, X_OEMBED_ATTR_KEYS),
      ...defaultsFromOptions(this.options, X_CHROME_ATTR_KEYS),
      caption: captionAttribute()
    }
  },

  parseHTML() {
    return [
      {
        tag: 'blockquote.twitter-tweet',
        getAttrs: (node: string | HTMLElement) => {
          if (typeof node === 'string') return {}

          const href = (node as HTMLElement).querySelector('a')?.getAttribute('href') ?? ''
          const src = normalizeXUrl(href)
          // Reject invalid/hostile hrefs outright — a `src: null` node would later
          // throw in renderHTML on the null text child.
          return src ? { src } : false
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes.src

    return [
      'blockquote',
      {
        class: 'twitter-tweet',
        ...HTMLAttributes
      },
      ['a', { href: url }, url]
    ]
  },

  addNodeView() {
    const editor = this.editor
    const kitOptions = this.options

    return ({ node, getPos }) => {
      const layoutRoot = document.createElement('div')
      let attrsSnapshot = node.attrs
      layoutRoot.classList.add('hypermultimedia--x__content')

      const embedTarget = document.createElement('div')
      const shellWidth = Number(node.attrs.maxwidth ?? X_EMBED_DEFAULT_MAXWIDTH)
      const shellHeight = Math.min(420, Math.round(shellWidth * 0.72))

      const applyLayout = (attrs: typeof node.attrs) => {
        const width = Number(attrs.maxwidth ?? X_EMBED_DEFAULT_MAXWIDTH)
        applyStyles(layoutRoot, {
          display: attrs.display,
          width,
          float: attrs.float,
          clear: attrs.clear,
          margin: attrs.margin,
          justifyContent: attrs.justifyContent
        })
        layoutRoot.style.maxWidth = '100%'
        layoutRoot.dataset.xTheme = (attrs.theme as XEmbedTheme | undefined) ?? kitOptions.theme
      }

      applyLayout(node.attrs)

      const { dom: loadingHost, controller } = wrapMediaWithLoadingShell(
        editor,
        { kind: 'embed', provider: 'X', width: shellWidth, height: shellHeight },
        embedTarget
      )

      layoutRoot.append(loadingHost)

      const mountAbort = new AbortController()
      let disposeHeightSync = watchXEmbedHeight(embedTarget, (height) => {
        loadingHost.style.height = `${Math.max(shellHeight, height)}px`
      })
      const endHeightSync = () => {
        disposeHeightSync()
        disposeHeightSync = () => {}
      }

      void mountXEmbed(embedTarget, buildXOEmbedParams(node.attrs, kitOptions), mountAbort.signal)
        .then((ok) => {
          endHeightSync()
          if (!ok) {
            controller.markError()
            return
          }
          loadingHost.classList.add('hm-media-host--fluid')
          loadingHost.style.width = '100%'
          loadingHost.style.height = 'auto'
          controller.markReady()
        })
        .catch(() => {
          endHeightSync()
          controller.markError()
        })

      const caption: CaptionHandle = createCaptionElement({
        editor,
        getPos,
        initial: readCaption(node)
      })
      layoutRoot.append(caption.el)

      return {
        dom: layoutRoot,
        // Caption is a nested contenteditable the node view owns; keep PM out of its events.
        stopEvent: (event: Event) => caption.el.contains(event.target as globalThis.Node | null),
        destroy: () => {
          endHeightSync()
          mountAbort.abort()
          controller.destroy()
          caption.destroy()
        },
        ignoreMutation: (mutation) => ignoreNodeViewSubtreeMutation(mutation, layoutRoot),
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false

          if (layoutAttrsChanged(updatedNode.attrs, attrsSnapshot, X_CHROME_ATTR_KEYS)) {
            applyLayout(updatedNode.attrs)
          }

          if (!embedAttrsEqual(updatedNode.attrs, attrsSnapshot, EMBED_ATTR_KEYS)) {
            return false
          }

          caption.sync(readCaption(updatedNode))
          attrsSnapshot = updatedNode.attrs
          return true
        }
      }
    }
  },

  addCommands() {
    return {
      setX:
        (options) =>
        ({ commands }) => {
          const src = normalizeXUrl(options.src)
          if (!src) return false

          // Omitted attrs fall back to schema defaults via ProseMirror computeAttrs.
          return commands.insertContent({
            type: this.name,
            attrs: { ...options, src, keyId: generateShortId() }
          })
        }
    }
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return []

    return [
      nodePasteRule({
        find: X_URL_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => {
          const src = normalizeXUrl(match.input ?? match[0])
          if (!src) return false
          // Schema defaults (maxwidth, theme, …) fill in via ProseMirror computeAttrs.
          return { src }
        }
      })
    ]
  }
})
