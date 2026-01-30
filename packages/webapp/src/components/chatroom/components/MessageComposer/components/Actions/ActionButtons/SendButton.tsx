import Icon from '@components/TipTap/toolbar/Icon'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'
type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

export const SendButton = ({ className, size = 20, ...props }: Props) => {
  const { editor, loading, submitMessage } = useMessageComposer()

  return (
    <Button
      className={twMerge('ml-auto', className)}
      disabled={loading || editor?.isEmpty}
      type="submit"
      onPress={submitMessage}
      {...props}>
      <Icon type="IoSend" size={size} />
    </Button>
  )
}
