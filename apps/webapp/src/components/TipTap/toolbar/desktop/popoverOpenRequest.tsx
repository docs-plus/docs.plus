import { usePopoverState } from '@components/ui/Popover'
import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useEffect } from 'react'

export type PopoverOpenRequest = {
  /** True while the toolbar popover is mounted to take the request. */
  canRequest: () => boolean
  request: () => void
  /** Mount inside the toolbar `Popover`, so an outside pick opens that same panel. */
  Listener: () => null
}

function createPopoverOpenRequest(canOpen?: () => boolean): PopoverOpenRequest {
  let open: (() => void) | null = null

  function Listener() {
    const { setOpen } = usePopoverState()

    useEffect(() => {
      const openPanel = () => setOpen(true)
      open = openPanel
      return () => {
        if (open === openPanel) open = null
      }
    }, [setOpen])

    return null
  }

  return {
    canRequest: () => open !== null && (!canOpen || canOpen()),
    request: () => {
      if (canOpen && !canOpen()) return
      open?.()
    },
    Listener
  }
}

// These live apart from `EditorToolbar`, so the slash items that `editorConfig` loads
// do not pull the whole toolbar into every editor bundle.
export const insertMediaOpenRequest = createPopoverOpenRequest(() => !isDocumentEditingLocked())
export const filterOpenRequest = createPopoverOpenRequest()
export const documentSettingsOpenRequest = createPopoverOpenRequest()
