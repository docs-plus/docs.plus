import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const SendButton = ({ className, size = 18, onPointerDown, ...props }: Props) => {
  const { canSend, submitMessage, isMobile } = useMessageComposer()

  return (
    <Button
      {...props}
      className={twMerge(
        'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
        !canSend && 'text-base-content/35',
        className
      )}
      disabled={!canSend}
      type="submit"
      onPress={submitMessage}
      onPointerDown={(e) => {
        if (isMobile) e.preventDefault()
        onPointerDown?.(e)
      }}
      aria-label="Send message">
      <Icons.send
        size={size}
        className={twMerge('pointer-events-none shrink-0 stroke-[1.75]', canSend && 'text-primary')}
      />
    </Button>
  )
}
