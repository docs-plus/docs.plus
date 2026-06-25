import { usePopoverState } from '@components/ui/Popover'
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
