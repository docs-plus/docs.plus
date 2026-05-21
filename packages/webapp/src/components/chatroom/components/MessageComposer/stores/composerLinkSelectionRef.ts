import { resolveDocSelection } from '@components/TipTap/hyperlinkPopovers/linkMarkUtils'
import type { DocSelectionRange } from '@components/TipTap/hyperlinkPopovers/types'
import type { Editor } from '@tiptap/core'

/** Last non-empty composer selection — iOS collapses PM selection on toolbar tap/blur. */
export const composerLinkSelectionRef = {
  current: null as DocSelectionRange | null
}

export function snapshotComposerLinkSelection(editor: Editor): void {
  const { from, to, empty } = editor.state.selection
  composerLinkSelectionRef.current = empty ? null : { from, to }
}

export function resolveComposerCreateSelection(editor: Editor): DocSelectionRange | undefined {
  return resolveDocSelection(editor, composerLinkSelectionRef.current)
}

export function clearComposerLinkSelection(): void {
  composerLinkSelectionRef.current = null
}
