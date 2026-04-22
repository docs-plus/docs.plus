import {
  type CommandProps,
  Editor,
  InputRule,
  Mark,
  markPasteRule,
  mergeAttributes
} from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { find, registerCustomProtocol } from 'linkifyjs'

import { HYPERLINK_MARK_NAME, PREVENT_AUTOLINK_META } from './constants'
import { editHyperlinkCommand } from './helpers/editHyperlink'
import { openCreateHyperlinkPopover as openCreateHyperlinkPopoverHelper } from './helpers/openCreateHyperlinkPopover'
import autolinkPlugin from './plugins/autolink'
import clickHandlerPlugin from './plugins/clickHandler'
import pasteHandlerPlugin from './plugins/pasteHandler'
import {
  DEFAULT_PROTOCOL,
  type LinkifyMatchLike,
  normalizeHref,
  normalizeLinkifyHref
} from './utils/normalizeHref'
import { isSafeHref } from './utils/validateURL'

export interface LinkProtocolOptions {
  scheme: string
  optionalSlashes?: boolean
}

/**
 * Context handed to the user-supplied `isAllowedUri` hook so callers
 * can compose against the extension's own validators instead of
 * re-implementing them. Mirrors `@tiptap/extension-link`'s signature so
 * existing policies port over without rewrites.
 */
export type IsAllowedUriContext = {
  /** The built-in safety gate (`isSafeHref`). Returns `false` for any scheme matched by `DANGEROUS_SCHEME_RE` (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`). */
  defaultValidate: (uri: string) => boolean
  /** Custom protocols registered via the `protocols` option. */
  protocols: Array<LinkProtocolOptions | string>
  /** The configured `defaultProtocol` (e.g. `'https'`). */
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
  view: EditorView
  link: HTMLAnchorElement
  nodePos: number
  attrs: HyperlinkAttributes
  linkCoords: { x: number; y: number; width: number; height: number }
  validate?: (url: string) => boolean
  /**
   * Composed XSS + `isAllowedUri` gate (defaults to plain `isSafeHref`
   * if the popover is invoked outside the click-handler plugin). The
   * prebuilt preview popover's "Open" button calls this before
   * `window.open`, so a tightened `isAllowedUri` policy applies to
   * every navigation surface — not just the click handler. BYO factories
   * should call it for the same reason.
   */
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

/**
 * Argument shape for every set/toggle hyperlink command (and their
 * `setLink` / `toggleLink` aliases). Hoisted so both the `Commands`
 * declaration and the runtime command bodies share one source of
 * truth — adding a new optional attr only touches this type.
 */
export type SetHyperlinkAttributes = {
  href: string
  target?: string | null
  title?: string | null
  image?: string | null
} & Record<string, unknown>

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hyperlink: {
      /**
       * Pure command: write the hyperlink mark over the current
       * selection. Returns `false` (no-op) if no `href` is supplied,
       * if the href fails the XSS gate, or if it fails the user's
       * `isAllowedUri`. To open the create popover instead, use
       * `openCreateHyperlinkPopover()`.
       */
      setHyperlink: (attributes: SetHyperlinkAttributes) => ReturnType
      /** Remove the hyperlink mark from the current selection. */
      unsetHyperlink: () => ReturnType
      /**
       * Toggle the hyperlink mark over the current selection. When the
       * selection already carries the mark, removes it; otherwise sets
       * it with the supplied attributes. Same XSS / `isAllowedUri`
       * gates as `setHyperlink`.
       */
      toggleHyperlink: (attributes: SetHyperlinkAttributes) => ReturnType
      /**
       * UI command: open the create-hyperlink popover anchored to the
       * current selection. No-op if `popovers.createHyperlink` is not
       * configured. This is the side-effecting half of the historic
       * `setHyperlink()` (no-args) behaviour, split out per Tiptap
       * canon (commands stay pure; UI is its own command).
       */
      openCreateHyperlinkPopover: (attributes?: Partial<HyperlinkAttributes>) => ReturnType
      editHyperlinkText: (text: string) => ReturnType
      editHyperlinkHref: (href: string) => ReturnType
      editHyperlink: (attributes?: {
        newText?: string
        newURL?: string
        title?: string
        image?: string
      }) => ReturnType
      /** Drop-in alias for `setHyperlink` — eases migration from `@tiptap/extension-link`. */
      setLink: (attributes: SetHyperlinkAttributes) => ReturnType
      /** Drop-in alias for `unsetHyperlink`. */
      unsetLink: () => ReturnType
      /** Drop-in alias for `toggleHyperlink`. */
      toggleLink: (attributes: SetHyperlinkAttributes) => ReturnType
    }
  }
}

/**
 * Compose the built-in `isSafeHref` gate with the user-supplied
 * `isAllowedUri` hook. Used at every WRITE boundary inside the
 * extension. Centralizing the composition here means the safety floor
 * (no `javascript:`/`data:`/`vbscript:`) is impossible to bypass — even
 * a permissive `isAllowedUri` runs AFTER `isSafeHref`.
 */
const buildHrefGate = (options: HyperlinkOptions) => {
  return (href: string | null | undefined): href is string => {
    if (!isSafeHref(href)) return false
    if (!options.isAllowedUri) return true
    return options.isAllowedUri(href, {
      defaultValidate: isSafeHref,
      protocols: options.protocols,
      defaultProtocol: options.defaultProtocol
    })
  }
}

/**
 * Shared body for `setHyperlink` / `setLink` / `toggleHyperlink` (set
 * branch). Normalizes the href against `defaultProtocol`, runs the
 * full XSS + `isAllowedUri` gate, applies the mark, and stamps
 * `PREVENT_AUTOLINK_META` so the autolink plugin doesn't immediately
 * undo the explicit edit. Returns `false` (Tiptap "no-op") on any
 * gate failure so command chains short-circuit cleanly.
 *
 * Composable: operates on the parent `tr` via `commands.setMark` (which
 * shares `tr` across the chain), so `editor.chain().extendMarkRange().setHyperlink({...}).run()`
 * dispatches a single transaction. An earlier draft used `chain().run()`
 * inside this body and produced "Applying a mismatched transaction"
 * when composed with `extendMarkRange` — same footgun fixed for
 * `editHyperlinkCommand` (see AGENTS.md).
 */
const applySetHyperlink = (
  markName: string,
  options: HyperlinkOptions,
  attributes: SetHyperlinkAttributes,
  { commands, tr, dispatch }: CommandProps
): boolean => {
  const rawHref = attributes.href
  if (!rawHref) return false
  const normalizedHref = normalizeHref(rawHref, options.defaultProtocol)
  if (!buildHrefGate(options)(normalizedHref)) return false
  const ok = commands.setMark(markName, { ...attributes, href: normalizedHref })
  if (ok && dispatch) tr.setMeta(PREVENT_AUTOLINK_META, true)
  return ok
}

/**
 * Composable counterpart for `unsetHyperlink` / `unsetLink`. Same
 * shared-`tr` rationale as `applySetHyperlink`.
 */
const applyUnsetHyperlink = (
  markName: string,
  { commands, tr, dispatch }: CommandProps
): boolean => {
  const ok = commands.unsetMark(markName, { extendEmptyMarkRange: true })
  if (ok && dispatch) tr.setMeta(PREVENT_AUTOLINK_META, true)
  return ok
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
      // `target` is stored on the mark for backwards compatibility with
      // older Yjs docs that recorded `target: "_blank"`, but is
      // INTENTIONALLY not serialized to the DOM (`rendered: false`) —
      // the click handler decides where to open the link, and emitting
      // `<a target="_blank">` would let the browser bypass the
      // click-handler guard entirely (and revive the historical
      // `target="_blank"` phishing surface). Pinned by AGENTS.md.
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
      // `title` is the standard HTML tooltip attribute — let it round-trip.
      title: {
        default: null
      },
      // `image` is metadata used only by the preview popover (favicon /
      // OG image). `<a>` has no standard `image` attribute, so rendering
      // it produces invalid HTML and pollutes downstream sanitizers.
      // Keep it on the mark for the popover, drop it from the DOM.
      image: {
        default: null,
        rendered: false
      }
    }
  },

  parseHTML() {
    // Reject anchors whose href uses any dangerous scheme. `isSafeHref`
    // is the single XSS gate the extension uses at every boundary
    // (parseHTML, input rules, paste rules, paste handler, command,
    // click, preview); centralizing the check there means a future
    // policy change (e.g. blocking `file:`) flows everywhere from one
    // edit. Returning `false` here tells ProseMirror to skip the mark.
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
    // Defense-in-depth on the READ side. `parseHTML` rejects dangerous
    // schemes on document load and `buildHrefGate` rejects them at every
    // write boundary, but a hostile mark could still reach renderHTML
    // through Yjs op replay, raw `addMark` from a downstream extension,
    // or schema migrations from older versions of this package. Blank
    // the href on serialize so a bad mark in the doc never round-trips
    // into a clickable `javascript:` (or any other dangerous scheme)
    // anchor downstream — matches `@tiptap/extension-link` v3 canon.
    const safe = isSafeHref(HTMLAttributes.href as string | null | undefined)
      ? HTMLAttributes
      : { ...HTMLAttributes, href: '' }
    return ['a', mergeAttributes(this.options.HTMLAttributes, safe), 0]
  },

  addCommands() {
    const editHyperlinkOptions = {
      validate: this.options.validate,
      markName: this.name,
      defaultProtocol: this.options.defaultProtocol,
      isAllowedUri: buildHrefGate(this.options)
    }

    const setHyperlinkCommand = (attributes: SetHyperlinkAttributes) => (props: CommandProps) =>
      applySetHyperlink(this.name, this.options, attributes, props)

    const unsetHyperlinkCommand = () => (props: CommandProps) =>
      applyUnsetHyperlink(this.name, props)

    const toggleHyperlinkCommand =
      (attributes: SetHyperlinkAttributes) => (props: CommandProps) => {
        if (props.editor.isActive(this.name)) return applyUnsetHyperlink(this.name, props)
        return applySetHyperlink(this.name, this.options, attributes, props)
      }

    return {
      setHyperlink: setHyperlinkCommand,
      unsetHyperlink: unsetHyperlinkCommand,
      toggleHyperlink: toggleHyperlinkCommand,

      // Side-effecting UI command (split out of the historic
      // `setHyperlink()` no-args behaviour). No-op when no popover
      // factory is wired up.
      openCreateHyperlinkPopover:
        (attributes) =>
        ({ editor }) =>
          openCreateHyperlinkPopoverHelper({
            editor,
            options: this.options,
            extensionName: this.name,
            attributes: attributes ?? {}
          }),

      // One options bag for the whole `editHyperlink*` family — keeps
      // the markName / validate / defaultProtocol / hrefGate wiring in
      // a single place so a future option only lands here once.
      editHyperlink: (attributes) =>
        editHyperlinkCommand({ ...attributes, ...editHyperlinkOptions })(),

      editHyperlinkText: (newText) => editHyperlinkCommand({ newText, ...editHyperlinkOptions })(),

      editHyperlinkHref: (newURL) => editHyperlinkCommand({ newURL, ...editHyperlinkOptions })(),

      // `@tiptap/extension-link` migration aliases. Implemented as
      // delegators (not as `Object.assign`'d references) so that future
      // policy changes to the canonical commands flow through automatically.
      setLink: setHyperlinkCommand,
      unsetLink: unsetHyperlinkCommand,
      toggleLink: toggleHyperlinkCommand
    }
  },

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {
      // BREAKING (v2): Mod-k now opens the create popover via the
      // dedicated `openCreateHyperlinkPopover` command instead of the
      // overloaded `setHyperlink()` no-args call. Behaviour for users
      // is identical when a popover factory is configured; programmatic
      // callers that relied on `setHyperlink()` opening the popover
      // must migrate.
      'Mod-k': () => this.editor.commands.openCreateHyperlinkPopover()
    }

    if (this.options.exitable) {
      // Exit the mark when the user steps off the right edge of a
      // hyperlink so the next typed character is plain text. We don't
      // *consume* ArrowRight (return `false`) — ProseMirror still moves
      // the caret as usual; we just clear the mark from `storedMarks`
      // for that single insertion. Mirrors `@tiptap/extension-link`.
      shortcuts.ArrowRight = () => exitMarkOnArrowRight(this.editor, this.type)
    }

    return shortcuts
  },

  addInputRules() {
    const isAllowed = buildHrefGate(this.options)
    return [
      new InputRule({
        find: /(\[([^\]]+)\]\(([^)]+)\))$/,
        handler: ({ state, range, match }) => {
          const [_fullMatch, , linkText, url] = match
          const { tr } = state
          const start = range.from
          const end = range.to

          const trimmed = url.trim()
          const normalizedUrl = normalizeHref(trimmed, this.options.defaultProtocol)
          if (!isAllowed(normalizedUrl)) return

          tr.replaceWith(start, end, state.schema.text(linkText))
          tr.addMark(start, start + linkText.length, this.type.create({ href: normalizedUrl }))
        }
      })
    ]
  },

  addPasteRules() {
    const isAllowed = buildHrefGate(this.options)
    const { defaultProtocol, shouldAutoLink, validate } = this.options
    return [
      markPasteRule({
        find: (text) =>
          find(text)
            .filter((link) => link.isLink)
            // Defense-in-depth: linkifyjs only emits its registered
            // protocols (http(s), mailto, tel, plus any registered via
            // `registerCustomProtocol`), so a `javascript:` href should
            // never reach this point. Re-check the full gate anyway —
            // a downstream extension might register a hostile protocol,
            // and we want one consistent gate at every write site.
            .filter((link) => isAllowed(normalizeLinkifyHref(link, defaultProtocol)))
            .filter((link) => (validate ? validate(link.value) : true))
            .filter((link) =>
              shouldAutoLink ? shouldAutoLink(normalizeLinkifyHref(link, defaultProtocol)) : true
            )
            .map((link) => ({
              text: link.value,
              index: link.start,
              data: link
            })),
        type: this.type,
        // `match.data` is set unconditionally in the `find` callback above,
        // so the cast is documentary — the branch itself is guaranteed live.
        getAttributes: (match) => ({
          href: normalizeLinkifyHref(match.data as LinkifyMatchLike, defaultProtocol)
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
          validate: this.options.validate,
          shouldAutoLink: this.options.shouldAutoLink,
          isAllowedUri: buildHrefGate(this.options),
          defaultProtocol: this.options.defaultProtocol
        })
      )
    }

    if (this.options.openOnClick) {
      plugins.push(
        clickHandlerPlugin({
          type: this.type,
          editor: this.editor,
          validate: this.options.validate,
          // Same gate the write boundaries use: dangerous schemes are
          // blocked unconditionally, then the user-supplied policy hook
          // runs. Readonly navigation (window.open) and middle-click
          // both honor this — a stale URL written before a tightened
          // `isAllowedUri` policy can still be visible in the doc but
          // can never be navigated to.
          isAllowedUri: buildHrefGate(this.options),
          popover: this.options.popovers.previewHyperlink,
          enableClickSelection: this.options.enableClickSelection
        })
      )
    }

    // pasteHandlerPlugin delegates to `editor.commands.setHyperlink`,
    // which runs the buildHrefGate composition itself — no need to
    // re-pass `isAllowedUri` here. `shouldAutoLink` IS passed because
    // it's a per-URI autolink veto, not part of the safety floor.
    if (this.options.linkOnPaste) {
      plugins.push(
        pasteHandlerPlugin({
          editor: this.editor,
          type: this.type,
          validate: this.options.validate,
          shouldAutoLink: this.options.shouldAutoLink,
          defaultProtocol: this.options.defaultProtocol
        })
      )
    }

    return plugins
  }
})

/**
 * Implements the `exitable` option. ArrowRight at the right boundary
 * of a hyperlink mark clears the mark from `storedMarks` for the
 * upcoming insertion, so the next typed character lands outside the
 * link. Returns `false` so ProseMirror still performs the default
 * cursor movement — we're piggy-backing on the keystroke, not
 * consuming it.
 */
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
