import Icon from '@components/TipTap/toolbar/Icon'
import React from 'react'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}

export const BoldButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleBold().run()}
      editor={editor}
      type="bold"
      tooltip="Bold (⌘+B)"
      className={className}
      {...props}>
      <Icon type="Bold" size={size} />
    </Button>
  )
}

BoldButton.displayName = 'BoldButton'
