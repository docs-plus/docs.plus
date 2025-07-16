import { create } from 'zustand'

export type SheetType = 'chatroom' | 'notifications' | 'filters' | null

interface SheetState {
  activeSheet: SheetType
  sheetData: Record<string, any>
  openSheet: (sheet: Exclude<SheetType, null>, data?: any) => void
  closeSheet: () => void
  isSheetOpen: (sheet: string) => boolean
}

export const useSheetStore = create<SheetState>((set, get) => ({
  activeSheet: null,
  sheetData: {},

  openSheet: (sheet, data = {}) => set({ activeSheet: sheet, sheetData: data }),

  closeSheet: () => set({ activeSheet: null, sheetData: {} }),

  isSheetOpen: (sheet) => get().activeSheet === sheet
}))
