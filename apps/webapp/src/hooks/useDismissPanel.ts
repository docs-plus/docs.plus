import { usePopoverState } from '@components/ui/Popover'
import { consumeHistoryDismissEntry } from '@hooks/useHistoryDismiss'
import { useSheetStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'
import { useCallback } from 'react'

export function useDismissPanel(variant: PanelSurfaceVariant = 'popover') {
  const { close: closePopover } = usePopoverState()
  const closeSheet = useSheetStore((state) => state.closeSheet)

  return useCallback(() => {
    if (variant === 'sheet') {
      closeSheet()
      return
    }
    closePopover()
  }, [variant, closePopover, closeSheet])
}

/**
 * The sheet's close pops its Back entry. A URL write must wait for that pop to land,
 * or the pop cancels the push or eats the hash. A popover owns no entry.
 */
export function useDismissPanelBeforeNavigate(variant: PanelSurfaceVariant = 'popover') {
  const dismissPanel = useDismissPanel(variant)
  return async () => {
    dismissPanel()
    if (variant === 'sheet') await consumeHistoryDismissEntry()
  }
}
