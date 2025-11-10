import Icon from '@components/TipTap/toolbar/Icon'
import Button from '../../ui/Button'
import { twMerge } from 'tailwind-merge'

type Props = {
  size?: number
} & React.ComponentProps<typeof Button>

export const AttachmentButton = ({ size = 16, ...props }: Props) => {
  return (
    <Button type="attachment" tooltip="Attachment" {...props}>
      <Icon type="MdOutlineAdd" size={size} />
    </Button>
  )
}
