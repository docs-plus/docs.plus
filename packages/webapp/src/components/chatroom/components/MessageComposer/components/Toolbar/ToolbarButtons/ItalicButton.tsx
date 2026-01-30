import Icon from '@components/TipTap/toolbar/Icon'
import React from 'react'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}

export const ItalicButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleItalic().run()}
      editor={editor}
      type="italic"
      tooltip="Italic (⌘+I)"
      className={className}
      {...props}>
      <Icon type="Italic" size={size} />
    </Button>
  )
}

ItalicButton.displayName = 'ItalicButton'
