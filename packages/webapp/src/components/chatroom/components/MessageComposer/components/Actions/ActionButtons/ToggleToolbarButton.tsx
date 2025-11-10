import Button from '../../ui/Button'
import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/useMessageComposer'

interface Props extends React.ComponentProps<typeof Button> {
  size?: number
  iconType?: string
}

export const ToggleToolbarButton = ({
  className,
  size = 20,
  iconType = 'MdFormatColorText',
  ...props
}: Props) => {
  const { isToolbarOpen, toggleToolbar } = useMessageComposer()

  return (
    <Button
      className={className}
      onPress={toggleToolbar}
      tooltip="Toolbar"
      tooltipPosition="tooltip-top"
      isActive={!isToolbarOpen}
      {...props}>
      <Icon type={iconType} size={size} />
    </Button>
  )
}
