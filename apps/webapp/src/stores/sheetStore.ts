import type { HyperlinkAttributes } from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type SheetState = 'closed' | 'open' | 'opening' | 'closing'

/**
 * Animation breather between `closeSheet` and the queued `openSheet`
 * triggered by `switchSheet`. Matches react-modal-sheet's default exit
 * transition; bumping it would let the user briefly see no sheet.
 */
const SHEET_TRANSITION_DELAY_MS = 250

/** Per-sheet contextual payload. */
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
   * Mobile media-controls sheet. The hypermultimedia kit's `mediaToolbar`
   * factory returns `null` on mobile and opens this with a stable `keyId`
   * so collab edits cannot stale the target node. Position resolves at apply
   * time via `findMediaNodePosByKeyId`. No global reads.
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

interface PendingSheet {
  sheet: keyof SheetDataMap
  data: SheetData
}

interface SheetStore {
  /** null = no sheet open. */
  activeSheet: SheetType
  sheetState: SheetState
  sheetData: SheetData
  /** Queued sheet that opens after the current one finishes closing. */
  pendingSheet: PendingSheet | null

  openSheet: <K extends keyof SheetDataMap>(sheet: K, data?: SheetDataMap[K]) => void
  closeSheet: () => void
  setSheetState: (state: SheetState) => void
  /**
   * Close the current sheet, then open a new one after the close animation.
   * If no sheet is active, opens immediately.
   */
  switchSheet: <K extends keyof SheetDataMap>(sheet: K, data?: SheetDataMap[K]) => void
  clearPendingSheet: () => void
}

export const useSheetStore = create<SheetStore>()(
  subscribeWithSelector((set, get) => ({
    activeSheet: null,
    sheetState: 'closed',
    sheetData: {} as SheetData,
    pendingSheet: null,

    setSheetState: (state) => set({ sheetState: state }),

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
      const currentState = get()

      if (currentState.sheetState === 'closed') {
        currentState.openSheet(sheet, data)
        return
      }

      currentState.closeSheet()
      set({ pendingSheet: { sheet, data: (data ?? {}) as SheetData } })
    },

    clearPendingSheet: () => set({ pendingSheet: null })
  }))
)

// Auto-open a pending sheet once the close animation has completed.
useSheetStore.subscribe(
  (state) => state.sheetState,
  (sheetState, prevSheetState) => {
    if (sheetState === 'closed' && prevSheetState === 'closing') {
      const { pendingSheet, openSheet, clearPendingSheet } = useSheetStore.getState()
      if (pendingSheet) {
        // Let the DOM clean up before re-mounting a new sheet.
        setTimeout(() => {
          openSheet(pendingSheet.sheet, pendingSheet.data)
          clearPendingSheet()
        }, SHEET_TRANSITION_DELAY_MS)
      }
    }
  }
)
