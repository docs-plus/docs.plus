import { Node, nodePasteRule } from '@tiptap/core'

import {
  captionAttribute,
  type CaptionHandle,
  createCaptionElement,
  readCaption
} from '../../caption'
import { wrapMediaWithLoadingShell } from '../../loading'
import { EMBED_CHROME_DEFAULTS, embedAttrsEqual, type EmbedNodeOptions } from '../../utils/embedKit'
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
      theme: {
        default: this.options.theme
      },
      lang: {
        default: this.options.lang
      },
      hide_media: {
        default: this.options.hide_media
      },
      hide_thread: {
        default: this.options.hide_thread
      },
      align: {
        default: null
      },
      dnt: {
        default: this.options.dnt
      },
      margin: {
        default: this.options.margin
      },
      clear: {
        default: this.options.clear
      },
      float: {
        default: this.options.float
      },
      display: {
        default: this.options.display
      },
      justifyContent: {
        default: this.options.justifyContent
      },
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
          return src ? { src } : { src: null }
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
        applyStyles(layoutRoot, {
          display: attrs.display,
          float: attrs.float,
          clear: attrs.clear,
          margin: attrs.margin,
          justifyContent: attrs.justifyContent
        })
      }

      applyLayout(node.attrs)

      const { dom: loadingHost, controller } = wrapMediaWithLoadingShell(
        editor,
        { kind: 'embed', provider: 'X', width: shellWidth, height: shellHeight },
        embedTarget
      )

      layoutRoot.append(loadingHost)

      const mountAbort = new AbortController()
      let stopHeightSync = watchXEmbedHeight(embedTarget, (height) => {
        loadingHost.style.height = `${Math.max(shellHeight, height)}px`
      })

      void mountXEmbed(embedTarget, buildXOEmbedParams(node.attrs, kitOptions), mountAbort.signal)
        .then((ok) => {
          stopHeightSync()
          stopHeightSync = () => {}
          if (!ok) {
            controller.markError()
            return
          }
          loadingHost.classList.add('hm-media-host--fluid')
          loadingHost.style.height = 'auto'
          controller.markReady()
        })
        .catch(() => {
          stopHeightSync()
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
          stopHeightSync()
          mountAbort.abort()
          controller.destroy()
          caption.destroy()
        },
        ignoreMutation: (mutation) => ignoreNodeViewSubtreeMutation(mutation, layoutRoot),
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false

          if (
            updatedNode.attrs.display !== attrsSnapshot.display ||
            updatedNode.attrs.float !== attrsSnapshot.float ||
            updatedNode.attrs.clear !== attrsSnapshot.clear ||
            updatedNode.attrs.margin !== attrsSnapshot.margin ||
            updatedNode.attrs.justifyContent !== attrsSnapshot.justifyContent
          ) {
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

          return commands.insertContent({
            type: this.name,
            attrs: {
              ...options,
              src,
              maxwidth: options.maxwidth ?? X_EMBED_DEFAULT_MAXWIDTH,
              theme: options.theme ?? this.options.theme,
              lang: options.lang ?? this.options.lang,
              hide_media: options.hide_media ?? this.options.hide_media,
              hide_thread: options.hide_thread ?? this.options.hide_thread,
              keyId: generateShortId()
            }
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
          return {
            src,
            maxwidth: X_EMBED_DEFAULT_MAXWIDTH,
            theme: this.options.theme,
            lang: this.options.lang,
            hide_media: this.options.hide_media,
            hide_thread: this.options.hide_thread
          }
        }
      })
    ]
  }
})
