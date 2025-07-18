import Button from '../../ui/Button'
import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

export const ToggleToolbarButton = ({ className, size = 20, ...props }: Props) => {
  const { toggleToolbar, setToggleToolbar } = useMessageComposer()

  return (
    <Button
      className={className}
      onPress={() => setToggleToolbar(!toggleToolbar)}
      tooltip="Toolbar"
      tooltipPosition="tooltip-top"
      isActive={!toggleToolbar}
      {...props}>
      <Icon type="MdFormatColorText" size={size} />
    </Button>
  )
}
