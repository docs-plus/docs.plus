import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks/indext'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}
export const BlockquoteButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleBlockquote().run()}
      editor={editor}
      type="blockquote"
      tooltip="Blockquote (⌘+⇧+9)"
      className={className}
      {...props}>
      <Icon type="TbBlockquote" size={size} />
    </Button>
  )
}

BlockquoteButton.displayName = 'BlockquoteButton'
