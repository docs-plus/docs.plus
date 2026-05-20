import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}

export const BulletListButton = ({ className, size = 18, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleBulletList().run()}
      editor={editor}
      type="bulletList"
      tooltip="Bullet List (⌘+⇧+7)"
      className={twMerge(
        'btn-ghost size-8 min-h-8 min-w-8 shrink-0 rounded-md border-0 p-0',
        className
      )}
      {...props}>
      <Icons.bulletList size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}

BulletListButton.displayName = 'BulletListButton'
