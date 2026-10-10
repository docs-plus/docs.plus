import { selectPadOwnsKeyboard } from '@components/chatroom/utils/selectPadOwnsKeyboard'
import Button from '@components/ui/Button'
import { useEnableEditor } from '@hooks/useCaretPosition'
import { Icons } from '@icons'
import { useChatStore, useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import React, { useCallback, useRef, useState } from 'react'

/**
 * Same `enableAndFocus()` as double-tap on the editor. On iOS, `click` on a `fixed`
 * control races focus vs the delayed synthetic click — mirror the editor’s `touchEnd`
 * path and suppress the follow-up `click`.
 */
const EditFAB = () => {
  const { isKeyboardOpen, enableAndFocus } = useEnableEditor()
  // This control is `fixed`, so without the gate it floats over an open pane.
  const padOwnsKeyboard = useChatStore(selectPadOwnsKeyboard)
  const suppressClickRef = useRef(false)
  const hidden = isKeyboardOpen || !padOwnsKeyboard
  // Fade in when the FAB comes back after the keyboard, the pane or history. Never fade at
  // the S0→S1 swap, because the S0 skeleton already drew a FAB bone here.
  const [fadeIn, setFadeIn] = useState(() => !useStore.getState().settings.editor.providerSyncing)
  if (hidden && !fadeIn) setFadeIn(true)

  const activate = useCallback(() => {
    enableAndFocus()
  }, [enableAndFocus])

  if (hidden) return null

  return (
    <Button
      type="button"
      aria-label="Edit document"
      onTouchEnd={(e) => {
        e.preventDefault()
        e.stopPropagation()
        suppressClickRef.current = true
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, 450)
        activate()
      }}
      onClick={(e) => {
        if (suppressClickRef.current) {
          e.preventDefault()
          return
        }
        activate()
      }}
      variant="primary"
      btnStyle="soft"
      shape="circle"
      className={twMerge(
        'edit-fab fixed right-6 bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] z-20 size-16',
        fadeIn && 'motion-safe:animate-[doc-content-in_180ms_ease-out_both]'
      )}
      startIcon={<Icons.pencil size={28} />}
    />
  )
}

export default EditFAB
