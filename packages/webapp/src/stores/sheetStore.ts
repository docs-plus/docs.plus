import type { HyperlinkAttributes } from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SheetType =
  | 'chatroom'
  | 'notifications'
  | 'filters'
  | 'emojiPicker'
  | 'linkPreview'
  | 'linkEditor'
  | null
export type SheetState = 'closed' | 'open' | 'opening' | 'closing'

/** Sheets that operate as overlays on the chatroom and should not trigger chatroom teardown. */
export const CHATROOM_OVERLAY_SHEETS: ReadonlySet<Exclude<SheetType, null>> = new Set([
  'emojiPicker'
])

/**
 * Animation breather between `closeSheet` and the queued `openSheet`
 * triggered by `switchSheet`. Matches react-modal-sheet's default exit
 * transition; bumping it would let the user briefly see no sheet.
 */
const SHEET_TRANSITION_DELAY_MS = 250

/** Per-sheet contextual payload. */
export interface SheetDataMap {
  chatroom: { headingId: string }
  notifications: Record<string, never>
  filters: Record<string, never>
  emojiPicker: { chatRoomState?: { headingId: string } }
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
  }
  /**
   * Mobile link editor sheet payload. `onSubmit` and `validate` are
   * imperative callbacks supplied by the caller (Tiptap extension or the
   * preview sheet's "Edit" action) since the editor command chain isn't
   * something the sheet should know about directly.
   *
   * `onBack` is optional: provide it when there's a meaningful previous
   * step to return to (e.g. the preview sheet's "Edit" action passes a
   * callback that switches back to `linkPreview`). When provided, the
   * sheet renders a back arrow in the header and hides the Cancel
   * button — back implicitly means "leave without applying."
   */
  linkEditor: {
    mode: 'create' | 'edit'
    initialHref: string
    onSubmit: (href: string) => void
    validate?: (url: string) => boolean
    onBack?: () => void
  }
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
        }, SHEET_TRANSITION_DELAY_MS)
      }
    }
  }
)
