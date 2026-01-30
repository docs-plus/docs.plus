import Button from '@components/ui/Button'
import { useCaretPosition, useEnableEditor } from '@hooks/useCaretPosition'
import { Pencil } from '@icons'
import React, { useCallback } from 'react'

/**
 * Floating Action Button for entering edit mode.
 * Places caret at optimal viewport position and opens keyboard.
 */
const EditFAB = () => {
  const { isKeyboardOpen, getTargetCaretPos } = useCaretPosition()
  const { enableAndFocusAt } = useEnableEditor()

  const handleClick = useCallback(() => {
    const targetPos = getTargetCaretPos()
    enableAndFocusAt(targetPos)
  }, [getTargetCaretPos, enableAndFocusAt])

  if (isKeyboardOpen) return null

  return (
    <Button
      onClick={handleClick}
      variant="primary"
      shape="circle"
      className="edit-fab fixed right-6 bottom-8 z-20 size-16"
      startIcon={<Pencil size={28} />}
    />
  )
}

export default EditFAB
