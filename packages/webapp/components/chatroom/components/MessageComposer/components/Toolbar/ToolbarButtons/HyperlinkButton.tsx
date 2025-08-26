import { useMessageComposer } from '../../../hooks/indext'
import Button from '../../ui/Button'
import Icon from '@components/TipTap/toolbar/Icon'

type Props = {
  className?: string
  size?: number
}
export const HyperlinkButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().setHyperlink().run()}
      editor={editor}
      type="hyperlink"
      tooltip="Hyperlink (⌘+K)"
      className={className}
      {...props}>
      <Icon type="Link" size={size} />
    </Button>
  )
}

HyperlinkButton.displayName = 'HyperlinkButton'
