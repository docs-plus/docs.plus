import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}
export const StrikethroughButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleStrike().run()}
      editor={editor}
      type="strike"
      tooltip="Strike (⌘+⇧+S)"
      className={className}
      {...props}>
      <Icon type="Strike" size={size} />
    </Button>
  )
}

StrikethroughButton.displayName = 'StrikethroughButton'
