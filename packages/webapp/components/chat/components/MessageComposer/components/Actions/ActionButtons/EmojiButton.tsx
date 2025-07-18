import { twMerge } from 'tailwind-merge'
import Button from '../../ui/Button'
import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

export const EmojiButton = ({ className, size = 20, ...props }: Props) => {
  const { editor } = useMessageComposer()

  const openEmojiPicker = (clickEvent: any) => {
    const event = new CustomEvent('toggelEmojiPicker', {
      detail: { clickEvent: clickEvent, editor, type: 'inserEmojiToEditor' }
    })
    document.dispatchEvent(event)
  }

  return (
    <Button
      className={className}
      onPress={openEmojiPicker}
      tooltip="Emoji"
      tooltipPosition="tooltip-top"
      {...props}>
      <Icon type="MdOutlineEmojiEmotions" size={size} />
    </Button>
  )
}
