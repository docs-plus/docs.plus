import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}

export const CodeBlockButton = ({ className, size = 18, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleCodeBlock().run()}
      editor={editor}
      type="codeBlock"
      tooltip="Code block"
      className={twMerge(
        'btn-ghost rounded-field size-8 min-h-8 min-w-8 shrink-0 border-0 p-0',
        className
      )}
      {...props}>
      <Icons.codeBlock size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}

CodeBlockButton.displayName = 'CodeBlockButton'
