import type { Editor } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import type { HyperlinkOptions, HyperlinkStorage } from '../hyperlink'

type Popovers = HyperlinkOptions['popovers']

/**
 * Internal — resolve the live `HyperlinkOptions` from a registered editor.
 * Throws when the extension is missing so the failure points at the
 * misconfiguration rather than at a downstream `undefined` access.
 */
export function getHyperlinkOptions(editor: Editor, callerName: string): HyperlinkOptions {
  const ext = editor.extensionManager.extensions.find((e) => e.name === HYPERLINK_MARK_NAME)
  if (!ext) throw new Error(`${callerName}: Hyperlink extension not registered on editor`)
  return ext.options as HyperlinkOptions
}

/** Internal — this editor's mark storage, for surfaces that hold only the editor. */
export function hyperlinkStorage(editor: Editor): HyperlinkStorage | undefined {
  // Through `unknown`: an app's `Storage` augmentation (Collaboration adds one) breaks a direct cast.
  return (editor.storage as unknown as Record<string, HyperlinkStorage | undefined>)[
    HYPERLINK_MARK_NAME
  ]
}

/**
 * Internal — the slot's factory, else the mark's prebuilt form.
 * `undefined` under `HyperlinkBase` when the slot is empty.
 */
export function openerFactory<K extends keyof Popovers>(
  editor: Editor,
  slot: K,
  callerName: string
): NonNullable<Popovers[K]> | undefined {
  return (
    getHyperlinkOptions(editor, callerName).popovers[slot] ??
    // `?.`: an `extend` whose `addStorage` skips `this.parent()` drops the field.
    hyperlinkStorage(editor)?.prebuiltPopovers?.[slot] ??
    undefined
  )
}
