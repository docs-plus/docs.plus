import { Editor, Mark, mergeAttributes } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { registerCustomProtocol } from 'linkifyjs'

import { buildHyperlinkCommands } from './commands'
import { HYPERLINK_MARK_NAME } from './constants'
import { createInteractions, createLinkContext } from './interactions'
import { isSafeHref } from './url-decisions'
import { DEFAULT_PROTOCOL } from './utils/normalizeHref'

// Re-export keeps the v2.0.0 import paths for downstream consumers.
export type {
  EditHyperlinkAttributes,
  HyperlinkPublicCommands,
  SetHyperlinkAttributes
} from './commands'

export interface LinkProtocolOptions {
  scheme: string
  optionalSlashes?: boolean
}

/** Context for the user `isAllowedUri` hook; mirrors `@tiptap/extension-link`. */
export type IsAllowedUriContext = {
  /** Built-in safety gate (`isSafeHref`). */
  defaultValidate: (uri: string) => boolean
  /** Protocols registered via the `protocols` option. */
  protocols: Array<LinkProtocolOptions | string>
  defaultProtocol: string
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
  view: import('@tiptap/pm/view').EditorView
  link: HTMLAnchorElement
  nodePos: number
  attrs: HyperlinkAttributes
  linkCoords: { x: number; y: number; width: number; height: number }
  validate?: (url: string) => boolean
  /** Composed XSS + `isAllowedUri` gate; BYO popovers must call this before any `window.open`. */
  isAllowedUri?: (uri: string) => boolean
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
  /** Scheme used by `normalizeHref` to promote bare domains. Default `'https'`. See README → Options. */
  defaultProtocol: string
  /** URI policy hook — runs AFTER `isSafeHref`, BEFORE the mark is written. Mirrors `@tiptap/extension-link`. */
  isAllowedUri?: (uri: string, ctx: IsAllowedUriContext) => boolean
  /** Per-link autolink veto. Return `false` to skip autolinking a specific URI (manual `setHyperlink` still works). */
  shouldAutoLink?: (uri: string) => boolean
  /** Click inside a link selects the whole mark range (editable mode only). Mirrors `@tiptap/extension-link`. */
  enableClickSelection: boolean
  /** ArrowRight at the right edge of a link exits the mark. Mirrors `@tiptap/extension-link`. */
  exitable: boolean
}

export const Hyperlink = Mark.create<HyperlinkOptions>({
  name: HYPERLINK_MARK_NAME,

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

  // No `onDestroy` linkifyjs.reset() — it clears the global registry and breaks coexisting editors.

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
      validate: undefined,
      defaultProtocol: DEFAULT_PROTOCOL,
      isAllowedUri: undefined,
      shouldAutoLink: undefined,
      enableClickSelection: false,
      exitable: false
    }
  },

  addAttributes() {
    return {
      href: {
        default: null
      },
      // `target` stays on the mark (Yjs back-compat) but `rendered: false` — emitting
      // `<a target="_blank">` would let the browser bypass the click-handler guard and
      // revive the historical `target="_blank"` phishing surface. Pinned by AGENTS.md.
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
      // `image` is preview-popover metadata (favicon / OG); `<a>` has no such attr, so don't emit.
      image: {
        default: null,
        rendered: false
      }
    }
  },

  parseHTML() {
    // `isSafeHref` is the single XSS gate at every boundary (parseHTML,
    // input/paste rules, command, click, preview). Returning `false`
    // here tells ProseMirror to skip the mark.
    return [
      {
        tag: 'a[href]',
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false
          const href = node.getAttribute('href') ?? ''
          return isSafeHref(href) ? null : false
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    // Defense-in-depth on READ — a hostile mark could reach here via
    // Yjs replay, foreign `addMark`, or schema migration. Blank the
    // href so a bad mark never round-trips into a clickable
    // `javascript:` anchor downstream. (Matches @tiptap/extension-link v3.)
    const safe = isSafeHref(HTMLAttributes.href as string | null | undefined)
      ? HTMLAttributes
      : { ...HTMLAttributes, href: '' }
    return ['a', mergeAttributes(this.options.HTMLAttributes, safe), 0]
  },

  addCommands() {
    return buildHyperlinkCommands({
      markName: this.name,
      options: this.options,
      urls: makeContext(this).urls
    })
  },

  addKeyboardShortcuts() {
    // BREAKING (v2): Mod-k routes to `openCreateHyperlinkPopover` (was overloaded `setHyperlink()`).
    const shortcuts: Record<string, () => boolean> = {
      'Mod-k': () => this.editor.commands.openCreateHyperlinkPopover()
    }

    if (this.options.exitable) {
      shortcuts.ArrowRight = () => exitMarkOnArrowRight(this.editor, this.type)
    }

    return shortcuts
  },

  addInputRules() {
    return createInteractions(makeContext(this)).inputRules
  },

  addPasteRules() {
    return createInteractions(makeContext(this)).pasteRules
  },

  addProseMirrorPlugins() {
    return createInteractions(makeContext(this)).plugins
  }
})

// One `LinkContext` allocation per extension hook (each fires once per init) — no storage, no cache.
function makeContext(self: { editor: Editor; type: MarkType; options: HyperlinkOptions }) {
  return createLinkContext({ editor: self.editor, type: self.type, options: self.options })
}

// `exitable` ArrowRight handler — clears the link mark from `storedMarks` so the next
// typed char lands outside the link. Returns `false` so ProseMirror still moves the caret.
function exitMarkOnArrowRight(editor: Editor, type: MarkType): boolean {
  const { state } = editor
  const { selection, tr } = state
  if (!selection.empty) return false
  const $pos = selection.$from
  const after = $pos.nodeAfter
  const before = $pos.nodeBefore
  const inMark = before?.marks.some((m) => m.type === type) ?? false
  const exiting = inMark && (!after || !after.marks.some((m) => m.type === type))
  if (!exiting) return false
  tr.setStoredMarks((state.storedMarks ?? $pos.marks()).filter((m) => m.type !== type))
  editor.view.dispatch(tr)
  return false
}
