import { Mark, markPasteRule, mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { find, registerCustomProtocol, reset } from 'linkifyjs'
import AutoHyperlinkPlugin from './plugins/autoHyperlink'
import HyperLinkClickHandlerPlugin from './plugins/clickHandler'
import HyperLinkPasteHandlerPlugin from './plugins/pasteHandler'
import editHyperlinkHelper from './helpers/editHyperlink'
export interface LinkProtocolOptions {
  scheme: string
  optionalSlashes?: boolean
}

export interface HyperlinkOptions {
  /**
   * If enabled, it adds links as you type, default is true.
   */
  autoHyperlink: boolean
  /**
   * An array of custom protocols to be registered with linkifyjs.
   */
  protocols: Array<LinkProtocolOptions | string>
  /**
   * If enabled, links will be opened on click, default is true.
   */
  openOnClick: boolean
  /**
   * Adds a link to the current selection if the pasted content only contains an url, default is true.
   */
  hyperlinkOnPaste: boolean
  /**
   * A list of HTML attributes to be rendered.
   */
  HTMLAttributes: Record<string, any>
  /**
   * A list of popovers to be rendered.
   * @default null
   * @example
   */
  popovers: {
    previewHyperlink?: ((options: any) => HTMLElement) | null
    createHyperlink?: ((options: any) => void) | null
  }
  /**
   * A validation function that modifies link verification for the auto linker.
   * @param url - The url to be validated.
   * @returns - True if the url is valid, false otherwise.
   */
  validate?: (url: string) => boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    link: {
      /**
       * Edit the hyperlink's text
       */
      editHyperLinkText: (text: string) => ReturnType

      /**
       * Edit the hyperlink's href value
       */
      editHyperLinkHref: (href: string) => ReturnType

      /**
       * Edit the hyperlink's
       */
      editHyperlink: (attributes?: {
        newText?: string
        newURL?: string
        title?: string
        image?: string
      }) => ReturnType

      /**
       *  Set a hyperlink
       */
      setHyperlink: (attributes?: { href: string; target?: string | null }) => ReturnType

      /**
       * Unset a link mark
       */
      unsetHyperlink: () => ReturnType
    }
  }
}

export const Hyperlink = Mark.create<HyperlinkOptions>({
  name: 'hyperlink',

  priority: 1000,

  keepOnSplit: false,

  onCreate() {
    this.options.protocols.forEach((protocol) => {
      if (typeof protocol === 'string') {
        registerCustomProtocol(protocol)
        return
      }
      registerCustomProtocol(protocol.scheme, protocol.optionalSlashes)
    })
  },

  onDestroy() {
    reset()
  },

  inclusive() {
    return this.options.autoHyperlink
  },

  addOptions() {
    return {
      openOnClick: true,
      hyperlinkOnPaste: true,
      autoHyperlink: true,
      protocols: [],
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        class: null
      },
      popovers: {
        previewHyperlink: null,
        createHyperlink: null
      },
      validate: undefined
    }
  },

  addAttributes() {
    return {
      href: {
        default: null
      },
      target: {
        default: this.options.HTMLAttributes.target
      },
      rel: {
        default: this.options.HTMLAttributes.rel
      },
      class: {
        default: this.options.HTMLAttributes.class
      },
      title: {
        default: null
      },
      image: {
        default: null
      }
    }
  },

  parseHTML() {
    return [{ tag: 'a[href]:not([href *= "javascript:" i])' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setHyperlink:
        (attributes) =>
        ({ editor, chain }) => {
          if (!this.options.popovers.createHyperlink) {
            return chain()
              .setMark(this.name, attributes)
              .setMeta('preventAutohyperlink', true)
              .run()
          } else {
            this.options.popovers.createHyperlink({
              editor,
              validate: this.options.validate,
              extentionName: this.name,
              attributes: attributes || {}
            })
            return true
          }
        },

      editHyperlink:
        (attributes) =>
        ({ editor }) => {
          return editHyperlinkHelper({
            ...attributes,
            editor,
            validate: this.options.validate
          })
        },

      editHyperLinkText:
        (newText) =>
        ({ editor }) => {
          return editHyperlinkHelper({
            editor,
            newText,
            validate: this.options.validate
          })
        },

      editHyperLinkHref:
        (newURL) =>
        ({ editor }) => {
          return editHyperlinkHelper({
            editor,
            validate: this.options.validate,
            newURL
          })
        },

      unsetHyperlink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name, { extendEmptyMarkRange: true })
            .setMeta('preventAutohyperlink', true)
            .run()
        }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => this.editor.commands.setHyperlink()
    }
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: (text) =>
          find(text)
            .filter((link) => {
              if (this.options.validate) {
                return this.options.validate(link.value)
              }

              return true
            })
            .filter((link) => link.isLink)
            .map((link) => ({
              text: link.value,
              index: link.start,
              data: link
            })),
        type: this.type,
        getAttributes: (match) => ({
          href: match.data?.href
        })
      })
    ]
  },

  addProseMirrorPlugins() {
    const plugins: Plugin[] = []

    if (this.options.autoHyperlink) {
      plugins.push(
        AutoHyperlinkPlugin({
          type: this.type,
          validate: this.options.validate
        })
      )
    }

    if (this.options.openOnClick) {
      plugins.push(
        HyperLinkClickHandlerPlugin({
          type: this.type,
          editor: this.editor,
          validate: this.options.validate,
          view: this.editor.view,
          popover: this.options.popovers.previewHyperlink
        })
      )
    }

    if (this.options.hyperlinkOnPaste) {
      plugins.push(
        HyperLinkPasteHandlerPlugin({
          editor: this.editor,
          type: this.type
        })
      )
    }

    return plugins
  }
})
