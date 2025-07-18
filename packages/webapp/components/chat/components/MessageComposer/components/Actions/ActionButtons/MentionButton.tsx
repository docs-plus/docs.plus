import { twMerge } from 'tailwind-merge'
import Button from '../../ui/Button'
import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

export const MentionButton = ({ className, size = 20, ...props }: Props) => {
  const { editor } = useMessageComposer()
  return (
    <Button
      className={className}
      onPress={() => editor?.chain().focus().insertContent('@').run()}
      tooltip="Mention"
      tooltipPosition="tooltip-top"
      {...props}>
      <Icon type="RiAtLine" size={size} />
    </Button>
  )
}
