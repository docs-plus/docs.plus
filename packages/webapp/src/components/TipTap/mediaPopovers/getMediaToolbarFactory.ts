import { createMediaToolbar, type MediaToolbarFactory } from '@docs.plus/extension-hypermultimedia'
import { type SheetDataMap, useSheetStore } from '@stores'

import { dismissSoftKeyboard } from '../hyperlinkPopovers/previewHyperlink'

/** Desktop floating toolbar; mobile opens `mediaControls` sheet and returns `null`. */
export const getMediaToolbarFactory = (isMobile: boolean): MediaToolbarFactory => {
  return (options) => {
    if (!isMobile) return createMediaToolbar(options)

    const { target, view, editor, nodeType } = options
    const wrapper = target.parentElement ?? target
    const nodePos = view.posAtDOM(wrapper, 0)
    const keyId = editor.state.doc.nodeAt(nodePos)?.attrs?.keyId as string | undefined
    if (!keyId) return null

    const store = useSheetStore.getState()
    if (store.activeSheet === 'mediaControls') {
      const open = store.sheetData as SheetDataMap['mediaControls']
      if (open.keyId === keyId) return null
    }

    dismissSoftKeyboard(editor)
    store.openSheet('mediaControls', { editor, keyId, nodeType })
    return null
  }
}
