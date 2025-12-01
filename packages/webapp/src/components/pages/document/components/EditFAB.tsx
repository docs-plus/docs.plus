import React, { useCallback } from 'react'
import { Pencil } from '@icons'
import { useCaretPosition, useEnableEditor } from '@hooks/useCaretPosition'

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
    <button
      onClick={handleClick}
      className="edit-fab btn btn-circle border-docsy bg-docsy active fixed right-6 bottom-8 z-20 size-16 text-white">
      <Pencil size={28} />
    </button>
  )
}

export default EditFAB
