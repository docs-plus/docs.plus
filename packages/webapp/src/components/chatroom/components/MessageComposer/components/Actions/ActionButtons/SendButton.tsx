import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const SendButton = ({ className, size = 18, ...props }: Props) => {
  const { canSend, submitMessage } = useMessageComposer()

  return (
    <Button
      className={twMerge(
        'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
        !canSend && 'text-base-content/35',
        className
      )}
      disabled={!canSend}
      type="submit"
      onPress={submitMessage}
      aria-label="Send message"
      {...props}>
      <Icons.send
        size={size}
        className={twMerge('pointer-events-none shrink-0 stroke-[1.75]', canSend && 'text-primary')}
      />
    </Button>
  )
}
