import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type SheetType = 'chatroom' | 'notifications' | 'filters' | 'emojiPicker' | null
export type SheetState = 'closed' | 'open' | 'opening' | 'closing'
interface SheetStore {
  activeSheet: SheetType
  sheetState: SheetState
  sheetData: Record<string, any>
  sheetContainerRef: HTMLDivElement | null
  pendingSheet: { sheet: Exclude<SheetType, null>; data?: any } | null
  openSheet: (sheet: Exclude<SheetType, null>, data?: any) => void
  closeSheet: () => void
  isSheetOpen: (sheet: string) => boolean
  setSheetContainerRef: (ref: HTMLDivElement | null) => void
  setSheetState: (state: SheetState) => void
  clearSheetState: () => void
  switchSheet: (sheet: Exclude<SheetType, null>, data?: any) => void
  clearPendingSheet: () => void
}

export const useSheetStore = create<SheetStore>()(
  subscribeWithSelector((set, get) => ({
    activeSheet: null,
    sheetState: 'closed',
    sheetData: {},
    sheetContainerRef: null,
    pendingSheet: null,

    setSheetContainerRef: (ref) => set({ sheetContainerRef: ref }),

    setSheetState: (state) => set({ sheetState: state }),

    openSheet: (sheet, data = {}) =>
      set({
        activeSheet: sheet,
        sheetData: data
        // sheetState: 'opening'
      }),

    closeSheet: () =>
      set({
        activeSheet: null,
        sheetData: {}
        // sheetState: 'closing'
      }),

    clearSheetState: () => set({ sheetData: {} }),

    isSheetOpen: (sheet) => get().activeSheet === sheet,

    switchSheet: (sheet, data = {}) => {
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

// Subscribe to sheetState changes and auto-open pending sheets
useSheetStore.subscribe(
  (state) => state.sheetState,
  (sheetState, prevSheetState) => {
    // When sheet becomes fully closed and we have a pending sheet
    if (sheetState === 'closed' && prevSheetState === 'closing') {
      const { pendingSheet, openSheet, clearPendingSheet } = useSheetStore.getState()
      if (pendingSheet) {
        // Small delay to ensure DOM cleanup is complete
        setTimeout(() => {
          openSheet(pendingSheet.sheet, pendingSheet.data)
          clearPendingSheet()
        }, 400)
      }
    }
  }
)
