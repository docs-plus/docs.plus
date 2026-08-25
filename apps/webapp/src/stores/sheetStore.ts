import type { HyperlinkAttributes } from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * Animation breather between `closeSheet` and the queued `openSheet`
 * triggered by `switchSheet`. Matches react-modal-sheet's default exit
 * transition; bumping it would let the user briefly see no sheet.
 */
const SHEET_TRANSITION_DELAY_MS = 250

export interface SheetDataMap {
  notifications: Record<string, never>
  filters: Record<string, never>
  bookmarks: Record<string, never>
  documentSettings: Record<string, never>
  /**
   * Mobile hyperlink preview sheet payload. `editor`, `nodePos`, and
   * `attrs` are passed through so the sheet can render metadata, write
   * the L1 cache back onto the mark, and dispatch unset/edit chains.
   */
  linkPreview: {
    href: string
    editor: Editor
    nodePos: number
    attrs: HyperlinkAttributes
    isAllowedUri?: (uri: string) => boolean
  }
  linkEditor: {
    mode: 'create' | 'edit'
    /** Threaded from the extension adapter; mirrors the `linkPreview` payload. No global editor reads. */
    editor: Editor
    initialHref: string
    /** Edit mode: seed the link-text input with the anchor's current text. */
    initialText?: string
    /** `text` is set when a suggestion was picked or text was manually edited; undefined = URL-only. */
    onSubmit: (result: { href: string; text?: string }) => boolean | void
    validate?: (url: string) => boolean
    onBack?: () => void
  }
  /**
   * Mobile media-controls sheet. `mediaToolbar` returns null on mobile and
   * opens this with a stable `keyId` so collab edits cannot stale the node.
   * Position resolves at apply via `findMediaNodePosByKeyId`. No global reads.
   */
  mediaControls: {
    editor: Editor
    keyId: string
    nodeType: string
  }
  /** Mobile media-insert sheet, opened from the toolbar image button. */
  mediaInsert: {
    editor: Editor
  }
  /** Mobile history compare picker. A is chosen here; B stays the viewed version. */
  historyCompare: Record<string, never>
  /** Mobile reaction picker. Selection reads `emojiPicker` in the chat store. */
  messageReaction: Record<string, never>
  /** Phone sign-in. Desktop still uses GlobalDialog. */
  signIn: {
    returnTo?: string
  }
}

export type SheetData = SheetDataMap[keyof SheetDataMap]
export type SheetType = keyof SheetDataMap | null

interface SheetStore {
  activeSheet: SheetType
  sheetData: SheetData

  openSheet: <K extends keyof SheetDataMap>(sheet: K, data?: SheetDataMap[K]) => void
  closeSheet: () => void
  switchSheet: <K extends keyof SheetDataMap>(sheet: K, data?: SheetDataMap[K]) => void
}

// Visibility and the queued open are mechanism for switchSheet alone. They
// live here, not in the store, so no caller can read or write them.
let isSheetVisible = false
let queuedOpen: (() => void) | null = null

export const useSheetStore = create<SheetStore>()(
  subscribeWithSelector((set, get) => ({
    activeSheet: null,
    sheetData: {} as SheetData,

    openSheet: (sheet, data) =>
      set({
        activeSheet: sheet,
        sheetData: (data ?? {}) as SheetData
      }),

    closeSheet: () =>
      set({
        activeSheet: null,
        sheetData: {} as SheetData
      }),

    switchSheet: (sheet, data) => {
      const { openSheet, closeSheet } = get()

      if (!isSheetVisible) {
        openSheet(sheet, data)
        return
      }

      closeSheet()
      queuedOpen = () => openSheet(sheet, data)
    }
  }))
)

/** react-modal-sheet lifecycle seam: spread onto the Sheet. No other caller. */
export const sheetTransitionHandlers = {
  onOpenStart: () => {
    isSheetVisible = true
  },
  onCloseEnd: () => {
    isSheetVisible = false
    const open = queuedOpen
    if (!open) return
    queuedOpen = null
    // Let the DOM clean up before re-mounting a new sheet.
    setTimeout(open, SHEET_TRANSITION_DELAY_MS)
  }
}
