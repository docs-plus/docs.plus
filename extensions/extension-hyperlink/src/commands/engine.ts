// Pure schema primitives for the hyperlink mark (write / remove / toggle).
// Returns composable Tiptap `Command` thunks that act on the shared
// `tr`, so callers can chain them with `extendMarkRange` etc. without
// nesting `editor.chain().run()` calls (which would produce
// "Applying a mismatched transaction").

import type { Command, CommandProps } from '@tiptap/core'

import { PREVENT_AUTOLINK_META } from '../constants'
import type { URLDecisions } from '../url-decisions'
import type { SetHyperlinkAttributes } from './surface'

export interface HyperlinkEngineDeps {
  markName: string
  urls: URLDecisions
}

export interface HyperlinkEngine {
  /** Write the mark at the current selection. Honors the URL Decisions gate. */
  set(attributes: SetHyperlinkAttributes): Command
  /** Remove the mark at the current selection (extends empty mark range). */
  unset(): Command
  /** Unset when active, set otherwise. Same gate stack as `set`. */
  toggle(attributes: SetHyperlinkAttributes): Command
}

/** Build an engine over `(markName, urls)`; thunks re-read `tr`/`state` so no stale snapshot escapes. */
export function createHyperlinkEngine({ markName, urls }: HyperlinkEngineDeps): HyperlinkEngine {
  const apply = (
    attrs: SetHyperlinkAttributes,
    { commands, tr, dispatch }: CommandProps
  ): boolean => {
    if (!attrs.href) return false
    const [decision] = urls.forWrite({ kind: 'href', href: attrs.href })
    if (!decision) return false
    const ok = commands.setMark(markName, { ...attrs, href: decision.href })
    if (ok && dispatch) tr.setMeta(PREVENT_AUTOLINK_META, true)
    return ok
  }

  const remove = ({ commands, tr, dispatch }: CommandProps): boolean => {
    const ok = commands.unsetMark(markName, { extendEmptyMarkRange: true })
    if (ok && dispatch) tr.setMeta(PREVENT_AUTOLINK_META, true)
    return ok
  }

  return {
    set: (attrs) => (props) => apply(attrs, props),
    unset: () => (props) => remove(props),
    toggle: (attrs) => (props) => {
      if (props.editor.isActive(markName)) return remove(props)
      return apply(attrs, props)
    }
  }
}
