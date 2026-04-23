import type { Editor } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import type { HyperlinkOptions } from '../hyperlink'

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
