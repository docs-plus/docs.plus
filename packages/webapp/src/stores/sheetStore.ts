import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SheetType = 'chatroom' | 'notifications' | 'filters' | 'emojiPicker' | null
export type SheetState = 'closed' | 'open' | 'opening' | 'closing'

/** Sheets that operate as overlays on the chatroom and should not trigger chatroom teardown. */
export const CHATROOM_OVERLAY_SHEETS: ReadonlySet<Exclude<SheetType, null>> = new Set([
  'emojiPicker'
])

/** Per-sheet contextual payload. */
export interface SheetDataMap {
  chatroom: { headingId: string }
  notifications: Record<string, never>
  filters: Record<string, never>
  emojiPicker: { chatRoomState?: { headingId: string } }
}

export type SheetData = SheetDataMap[keyof SheetDataMap]

interface PendingSheet {
  sheet: Exclude<SheetType, null>
  data: SheetData
}

interface SheetStore {
  /** Currently visible sheet (null = no sheet open). */
  activeSheet: SheetType
  /** Lifecycle state of the sheet animation. */
  sheetState: SheetState
  /** Contextual data passed when the sheet was opened. */
  sheetData: SheetData
  /** DOM ref to the Sheet.Container element (used by mobile composer). */
  sheetContainerRef: HTMLDivElement | null
  /** Queued sheet that will open after the current one finishes closing. */
  pendingSheet: PendingSheet | null

  openSheet: (sheet: Exclude<SheetType, null>, data?: SheetData) => void
  closeSheet: () => void
  isSheetOpen: (sheet: string) => boolean
  setSheetContainerRef: (ref: HTMLDivElement | null) => void
  setSheetState: (state: SheetState) => void
  clearSheetState: () => void
  /**
   * Close the current sheet, then open a new one after the close animation.
   * If no sheet is active, opens immediately.
   */
  switchSheet: (sheet: Exclude<SheetType, null>, data?: SheetData) => void
  clearPendingSheet: () => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSheetStore = create<SheetStore>()(
  subscribeWithSelector((set, get) => ({
    activeSheet: null,
    sheetState: 'closed',
    sheetData: {} as SheetData,
    sheetContainerRef: null,
    pendingSheet: null,

    setSheetContainerRef: (ref) => set({ sheetContainerRef: ref }),

    setSheetState: (state) => set({ sheetState: state }),

    openSheet: (sheet, data = {} as SheetData) =>
      set({
        activeSheet: sheet,
        sheetData: data
      }),

    closeSheet: () =>
      set({
        activeSheet: null,
        sheetData: {} as SheetData
      }),

    clearSheetState: () => set({ sheetData: {} as SheetData }),

    isSheetOpen: (sheet) => get().activeSheet === sheet,

    switchSheet: (sheet, data = {} as SheetData) => {
      const currentState = get()

      // If no sheet is open, open immediately
      if (currentState.sheetState === 'closed') {
        currentState.openSheet(sheet, data)
        return
      }

      // Otherwise, close current and queue the new one
      currentState.closeSheet()
      set({ pendingSheet: { sheet, data } })
    },

    clearPendingSheet: () => set({ pendingSheet: null })
  }))
)

// ---------------------------------------------------------------------------
// Side-effect: auto-open pending sheets after close animation completes
// ---------------------------------------------------------------------------

useSheetStore.subscribe(
  (state) => state.sheetState,
  (sheetState, prevSheetState) => {
    if (sheetState === 'closed' && prevSheetState === 'closing') {
      const { pendingSheet, openSheet, clearPendingSheet } = useSheetStore.getState()
      if (pendingSheet) {
        // Small delay to let the DOM clean up before re-mounting a new sheet
        setTimeout(() => {
          openSheet(pendingSheet.sheet, pendingSheet.data)
          clearPendingSheet()
        }, 250)
      }
    }
  }
)
