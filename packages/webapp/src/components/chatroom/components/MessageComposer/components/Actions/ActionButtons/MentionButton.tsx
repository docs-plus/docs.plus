import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const MentionButton = ({ className, size = 18, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      className={twMerge(
        'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
        className
      )}
      onPress={(e) => {
        e.preventDefault()
        editor?.chain().focus().insertContent('@').run()
      }}
      tooltip="Mention"
      tooltipPosition="top"
      aria-label="Mention someone"
      {...props}>
      <Icons.mention size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}
