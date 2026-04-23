import { Editor, Mark, mergeAttributes } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { registerCustomProtocol } from 'linkifyjs'

import { buildHyperlinkCommands } from './commands'
import { HYPERLINK_MARK_NAME } from './constants'
import { createInteractions, createLinkContext, type LinkContext } from './interactions'
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

/**
 * Built-in hyperlink mark attributes.
 *
 * `Extra` lets consumers extend the shape with their own typed fields
 * without losing autocomplete on the built-ins:
 *
 * ```ts
 * type CampaignAttrs = HyperlinkAttributes<{ campaign?: string }>
 * const attrs: CampaignAttrs = { href: 'https://x', campaign: 'spring' }
 * attrs.href      // string | null
 * attrs.campaign  // string | undefined
 * ```
 *
 * Defaulting `Extra` to `Record<string, unknown>` preserves the open
 * index signature the v2 surface shipped with — `attrs[someUntypedKey]`
 * still resolves to `unknown` when no `Extra` is supplied.
 */
export type HyperlinkAttributes<Extra extends Record<string, unknown> = Record<string, unknown>> = {
  href: string | null
  target: string | null
  rel: string | null
  class: string | null
  title: string | null
  image: string | null
} & Extra

export type PreviewHyperlinkOptions = {
  editor: Editor
  link: HTMLAnchorElement
  nodePos: number
  attrs: HyperlinkAttributes
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

export type EditHyperlinkOptions = {
  editor: Editor
  link: HTMLAnchorElement
  validate?: (url: string) => boolean
  /** Override the default Back behaviour. Default re-opens the preview popover via `openPreviewHyperlink`. */
  onBack?: () => void
  /** Mark name; defaults to `HYPERLINK_MARK_NAME`. */
  markName?: string
}

export interface HyperlinkOptions {
  autolink: boolean
  protocols: Array<LinkProtocolOptions | string>
  openOnClick: boolean
  linkOnPaste: boolean
  HTMLAttributes: Partial<HyperlinkAttributes>
  popovers: {
    previewHyperlink?: ((options: PreviewHyperlinkOptions) => HTMLElement | null) | null
    editHyperlink?: ((options: EditHyperlinkOptions) => HTMLElement | null) | null
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

/** Extension storage; one slot per editor instance. */
export interface HyperlinkStorage {
  /**
   * Cached `LinkContext` for the editor. Populated on first access from
   * any of the four `add*` hooks; downstream calls reuse the same
   * URL Decisions pipeline instead of allocating a fresh one each time.
   */
  context: LinkContext | null
}

export const Hyperlink = Mark.create<HyperlinkOptions, HyperlinkStorage>({
  name: HYPERLINK_MARK_NAME,

  priority: 1000,

  keepOnSplit: false,

  addStorage() {
    return { context: null }
  },

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
        editHyperlink: null,
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
      urls: getContext(this).urls
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
    return createInteractions(getContext(this)).inputRules
  },

  addPasteRules() {
    return createInteractions(getContext(this)).pasteRules
  },

  addProseMirrorPlugins() {
    return createInteractions(getContext(this)).plugins
  }
})

// One `LinkContext` per editor — cached on `storage.context` and shared
// across the four `add*` hooks so the URL Decisions pipeline (and its
// validate / autolink / shouldAutoLink closures) are allocated once.
function getContext(self: {
  editor: Editor
  type: MarkType
  options: HyperlinkOptions
  storage: HyperlinkStorage
}): LinkContext {
  if (self.storage.context) return self.storage.context
  const ctx = createLinkContext({ editor: self.editor, type: self.type, options: self.options })
  self.storage.context = ctx
  return ctx
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
