import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

interface Props extends React.ComponentProps<typeof Button> {
  size?: number
  iconType?: string
}

export const ToggleToolbarButton = ({
  className,
  size = 18,
  iconType = 'MdFormatColorText',
  ...props
}: Props) => {
  const { showFormattingToolbar, toggleToolbar } = useMessageComposer()

  return (
    <Button
      className={className}
      onPress={toggleToolbar}
      tooltip={showFormattingToolbar ? 'Hide formatting' : 'Show formatting'}
      tooltipPosition="top"
      isActive={showFormattingToolbar}
      aria-pressed={showFormattingToolbar}
      {...props}>
      <Icon type={iconType} size={size} />
    </Button>
  )
}
