import { create } from 'zustand'

export type SheetType = 'chatroom' | 'notifications' | 'filters' | 'emojiPicker' | null

interface SheetState {
  activeSheet: SheetType
  sheetData: Record<string, any>
  sheetContainerRef: HTMLDivElement | null
  openSheet: (sheet: Exclude<SheetType, null>, data?: any) => void
  closeSheet: () => void
  isSheetOpen: (sheet: string) => boolean
  setSheetContainerRef: (ref: HTMLDivElement | null) => void
  clearSheetState: () => void
}

export const useSheetStore = create<SheetState>((set, get) => ({
  activeSheet: null,
  sheetData: {},
  sheetContainerRef: null,

  setSheetContainerRef: (ref) => set({ sheetContainerRef: ref }),

  openSheet: (sheet, data = {}) => set({ activeSheet: sheet, sheetData: data }),

  closeSheet: () => set({ activeSheet: null, sheetData: {} }),

  clearSheetState: () => set({ sheetData: {} }),

  isSheetOpen: (sheet) => get().activeSheet === sheet
}))
