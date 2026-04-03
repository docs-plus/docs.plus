/**
 * Wire format (Hocuspocus stateless): client sends `{ msg: 'history', type, documentId? }`;
 * server answers on the same connection with `{ msg: 'history.response', type, response }`.
 * History queries always use the WebSocket document room id; a mismatched `documentId` gets `history_failed`.
 * List payloads may include `latestSnapshot` (one RTT); failures use `error: 'history_failed'`.
 */
import type { Editor } from '@tiptap/react'
import type { HistoryItem } from '@types'

import { tryGetProsemirrorFromHistoryYdoc } from './helpers'

export type ApplyHistoryToEditorResult = 'applied' | 'decode_failed' | 'no_editor'

/** Yjs snapshot (base64) → ProseMirror → TipTap `setContent` — single path for all history hydrations. */
export function applyHistoryItemToEditor(
  editor: Editor | null,
  item: Pick<HistoryItem, 'data' | 'version'>
): ApplyHistoryToEditorResult {
  const doc = tryGetProsemirrorFromHistoryYdoc(item.data)
  if (doc == null) return 'decode_failed'
  if (!editor || editor.isDestroyed) return 'no_editor'
  try {
    editor.commands.setContent(doc)
    return 'applied'
  } catch {
    return 'decode_failed'
  }
}
