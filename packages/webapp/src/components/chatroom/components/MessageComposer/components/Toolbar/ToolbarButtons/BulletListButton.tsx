import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks/indext'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}
export const BulletListButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleBulletList().run()}
      editor={editor}
      type="bulletList"
      tooltip="Bullet List (⌘+⇧+7)"
      className={className}
      {...props}>
      <Icon type="BulletList" size={size} />
    </Button>
  )
}

BulletListButton.displayName = 'BulletListButton'
