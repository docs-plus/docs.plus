import * as toast from '@components/toast'
import type { Editor } from '@tiptap/react'
import type { HistoryItem } from '@types'
import { logger } from '@utils/logger'

import { getCachedProsemirrorFromHistoryYdoc } from './historyDecodeCache'

export type ApplyHistoryToEditorResult = 'applied' | 'decode_failed' | 'no_editor'

export const HISTORY_DECODE_FAILED_MESSAGE =
  'Could not display this version. Try another revision or reload the page.'

export function applyHistoryItemToEditor(
  editor: Editor | null,
  item: Pick<HistoryItem, 'data' | 'version'>
): ApplyHistoryToEditorResult {
  const doc = getCachedProsemirrorFromHistoryYdoc(item.version, item.data)
  if (doc == null) return 'decode_failed'
  if (!editor || editor.isDestroyed) return 'no_editor'
  try {
    editor.commands.setContent(doc)
    return 'applied'
  } catch {
    return 'decode_failed'
  }
}

export function resolveHistoryApplyResult(
  result: ApplyHistoryToEditorResult,
  options: { logMessage: string; setLoadingHistory: (loading: boolean) => void }
): void {
  if (result === 'decode_failed') {
    logger.error(options.logMessage)
    toast.Error(HISTORY_DECODE_FAILED_MESSAGE)
    options.setLoadingHistory(false)
    return
  }
  if (result === 'applied') {
    options.setLoadingHistory(false)
  }
}
