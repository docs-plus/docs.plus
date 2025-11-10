import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/indext'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}
export const OrderedListButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleOrderedList().run()}
      editor={editor}
      type="orderedList"
      tooltip="Ordered List (⌘+⇧+7)"
      className={className}
      {...props}>
      <Icon type="OrderList" size={size} />
    </Button>
  )
}

OrderedListButton.displayName = 'OrderedListButton'
