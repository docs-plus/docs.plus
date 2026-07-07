import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}

export const StrikethroughButton = ({ className, size = 18, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleStrike().run()}
      editor={editor}
      type="strike"
      tooltip="Strikethrough (⌘+⇧+S)"
      className={twMerge(
        'btn-ghost rounded-field size-8 min-h-8 min-w-8 shrink-0 border-0 p-0',
        className
      )}
      {...props}>
      <Icons.strikethrough size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}

StrikethroughButton.displayName = 'StrikethroughButton'
