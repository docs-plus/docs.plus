import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

export const SendButton = ({ className, size = 18, ...props }: Props) => {
  const { canSend, submitMessage } = useMessageComposer()

  return (
    <Button
      className={className}
      disabled={!canSend}
      type="submit"
      onPress={submitMessage}
      aria-label="Send message"
      {...props}>
      <Icon type="IoSend" size={size} />
    </Button>
  )
}
