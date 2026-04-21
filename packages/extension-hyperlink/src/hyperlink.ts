import { Editor, InputRule, Mark, markPasteRule, mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { find, registerCustomProtocol } from 'linkifyjs'

import { editHyperlinkCommand } from './helpers/editHyperlink'
import { createFloatingToolbar } from './helpers/floatingToolbar'
import autolinkPlugin from './plugins/autolink'
import clickHandlerPlugin from './plugins/clickHandler'
import pasteHandlerPlugin from './plugins/pasteHandler'
import { type LinkifyMatchLike, normalizeHref, normalizeLinkifyHref } from './utils/normalizeHref'
import { DANGEROUS_SCHEME_RE } from './utils/validateURL'

const INPUT_FOCUS_DELAY_MS = 100

export interface LinkProtocolOptions {
  scheme: string
  optionalSlashes?: boolean
}

export type HyperlinkAttributes = {
  href: string | null
  target: string | null
  rel: string | null
  class: string | null
  title: string | null
  image: string | null
  [key: string]: unknown
}

export type PreviewHyperlinkOptions = {
  editor: Editor
  view: EditorView
  link: HTMLAnchorElement
  nodePos: number
  attrs: HyperlinkAttributes
  linkCoords: { x: number; y: number; width: number; height: number }
  validate?: (url: string) => boolean
}

export type CreateHyperlinkOptions = {
  editor: Editor
  extensionName: string
  attributes: Partial<HyperlinkAttributes>
  validate?: (url: string) => boolean
}

export interface HyperlinkOptions {
  autolink: boolean
  protocols: Array<LinkProtocolOptions | string>
  openOnClick: boolean
  linkOnPaste: boolean
  HTMLAttributes: Partial<HyperlinkAttributes>
  popovers: {
    previewHyperlink?: ((options: PreviewHyperlinkOptions) => HTMLElement | null) | null
    createHyperlink?: ((options: CreateHyperlinkOptions) => HTMLElement | null) | null
  }
  validate?: (url: string) => boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hyperlink: {
      editHyperlinkText: (text: string) => ReturnType
      editHyperlinkHref: (href: string) => ReturnType
      editHyperlink: (attributes?: {
        newText?: string
        newURL?: string
        title?: string
        image?: string
      }) => ReturnType
      setHyperlink: (attributes?: { href: string; target?: string | null }) => ReturnType
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
      } else {
        registerCustomProtocol(protocol.scheme, protocol.optionalSlashes)
      }
    })
  },

  // linkifyjs.reset() was removed intentionally — it clears the global
  // protocol registry and breaks other editors on the same page.
  // Registered protocols are additive and persist for the page lifetime.

  inclusive() {
    return this.options.autolink
  },

  addOptions() {
    return {
      openOnClick: true,
      linkOnPaste: true,
      autolink: true,
      protocols: [],
      HTMLAttributes: {
        target: null,
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
        default: this.options.HTMLAttributes.target,
        rendered: false
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
    // Reject anchors whose href uses any dangerous scheme. Keeping the list
    // aligned with DANGEROUS_SCHEME_RE is the one XSS invariant this
    // extension enforces at every boundary (parseHTML, input rules, paste,
    // click, preview); update them together.
    return [
      {
        tag: 'a[href]',
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false
          const href = node.getAttribute('href') ?? ''
          return DANGEROUS_SCHEME_RE.test(href) ? false : null
        }
      }
    ]
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
            // Normalize at the command boundary so programmatic callers
            // (no popover) get the same bare-domain → `https://` guarantee
            // the create popover applies. When a popover IS configured
            // the factory is responsible for normalizing its own input.
            const normalized = attributes?.href
              ? { ...attributes, href: normalizeHref(attributes.href) }
              : attributes
            return chain().setMark(this.name, normalized).setMeta('preventAutolink', true).run()
          }

          const content = this.options.popovers.createHyperlink({
            editor,
            validate: this.options.validate,
            extensionName: this.name,
            attributes: attributes || {}
          })

          if (!content) return true

          // Capture the selection range ONCE at popover open. The
          // coords callback below recomputes viewport coords from these
          // doc positions on every reposition (mount, scroll, resize)
          // so the popover stays glued to the selection while the user
          // scrolls.
          const { from, to } = editor.state.selection

          const toolbar = createFloatingToolbar({
            coordinates: {
              getBoundingClientRect: () => {
                // Local edits are blocked while the popover is open, but
                // remote collab ops (Yjs/Hocuspocus) can shrink the doc
                // and make `from`/`to` out-of-range, at which point
                // `coordsAtPos` throws. The anchor is gone — there's no
                // text left for the link to attach to — so dismiss the
                // popover entirely. Returning an off-screen rect alone
                // would leave the form invisibly open with `autoUpdate`
                // still firing and focus still trapped inside it.
                //
                // The hide is queued on a microtask (not called inline)
                // because we're running inside `computePosition` via
                // `autoUpdate`. Deferring keeps the coords callback
                // single-purpose and lets `computePosition` resolve
                // before the toolbar is torn down — `updatePosition`'s
                // post-await `!visible` guard then bails out cleanly.
                // The off-screen rect bridges the one-microtask gap so
                // the popover doesn't flash at its last-known position
                // before `hide()` lands.
                try {
                  const start = editor.view.coordsAtPos(from)
                  const end = editor.view.coordsAtPos(to)
                  return {
                    x: start.left,
                    y: start.top,
                    width: end.left - start.left,
                    height: end.bottom - start.top
                  }
                } catch {
                  queueMicrotask(() => toolbar.hide())
                  return { x: -9999, y: -9999, width: 0, height: 0 }
                }
              },
              contextElement: editor.view.dom
            },
            content,
            placement: 'bottom',
            showArrow: true
          })

          toolbar.show()

          const input = content.querySelector('input')
          if (input) setTimeout(() => input.focus(), INPUT_FOCUS_DELAY_MS)

          return true
        },

      editHyperlink: (attributes) =>
        editHyperlinkCommand({
          ...attributes,
          validate: this.options.validate,
          markName: this.name
        })(),

      editHyperlinkText: (newText) =>
        editHyperlinkCommand({
          newText,
          validate: this.options.validate,
          markName: this.name
        })(),

      editHyperlinkHref: (newURL) =>
        editHyperlinkCommand({
          newURL,
          validate: this.options.validate,
          markName: this.name
        })(),

      unsetHyperlink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name, { extendEmptyMarkRange: true })
            .setMeta('preventAutolink', true)
            .run()
        }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => this.editor.commands.setHyperlink()
    }
  },

  addInputRules() {
    return [
      new InputRule({
        find: /(\[([^\]]+)\]\(([^)]+)\))$/,
        handler: ({ state, range, match }) => {
          const [_fullMatch, , linkText, url] = match
          const { tr } = state
          const start = range.from
          const end = range.to

          const trimmed = url.trim()
          if (DANGEROUS_SCHEME_RE.test(trimmed)) return
          const normalizedUrl = normalizeHref(trimmed)

          // Replace the markdown text with just the link text
          tr.replaceWith(start, end, state.schema.text(linkText))

          // Apply the hyperlink mark to the replaced text
          tr.addMark(start, start + linkText.length, this.type.create({ href: normalizedUrl }))
        }
      })
    ]
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
        // `match.data` is set unconditionally in the `find` callback above,
        // so the cast is documentary — the branch itself is guaranteed live.
        getAttributes: (match) => ({
          href: normalizeLinkifyHref(match.data as LinkifyMatchLike)
        })
      })
    ]
  },

  addProseMirrorPlugins() {
    const plugins: Plugin[] = []

    if (this.options.autolink) {
      plugins.push(
        autolinkPlugin({
          type: this.type,
          validate: this.options.validate
        })
      )
    }

    if (this.options.openOnClick) {
      plugins.push(
        clickHandlerPlugin({
          type: this.type,
          editor: this.editor,
          validate: this.options.validate,
          popover: this.options.popovers.previewHyperlink
        })
      )
    }

    if (this.options.linkOnPaste) {
      plugins.push(
        pasteHandlerPlugin({
          editor: this.editor,
          type: this.type,
          validate: this.options.validate
        })
      )
    }

    return plugins
  }
})
