import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'
type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

export const MentionButton = ({ className, size = 20, ...props }: Props) => {
  const { editor } = useMessageComposer()
  return (
    <Button
      className={className}
      onPress={(e) => {
        e.preventDefault()
        editor?.chain().focus().insertContent('@').run()
      }}
      tooltip="Mention"
      tooltipPosition="tooltip-top"
      {...props}>
      <Icon type="RiAtLine" size={size} />
    </Button>
  )
}
