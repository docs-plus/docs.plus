import Button from '@components/ui/Button'
import { useEnableEditor } from '@hooks/useCaretPosition'
import { Icons } from '@icons'
import React, { useCallback, useRef } from 'react'

/**
 * Same `enableAndFocus()` as double-tap on the editor. On iOS, `click` on a `fixed`
 * control races focus vs the delayed synthetic click — mirror the editor’s `touchEnd`
 * path and suppress the follow-up `click`.
 */
const EditFAB = () => {
  const { isKeyboardOpen, enableAndFocus } = useEnableEditor()
  const suppressClickRef = useRef(false)

  const activate = useCallback(() => {
    enableAndFocus()
  }, [enableAndFocus])

  if (isKeyboardOpen) return null

  return (
    <Button
      type="button"
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
      shape="circle"
      className="edit-fab fixed right-6 bottom-8 z-20 size-16"
      startIcon={<Icons.pencil size={28} />}
    />
  )
}

export default EditFAB
