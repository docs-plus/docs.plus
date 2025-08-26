import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/indext'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}
export const CodeBlockButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleCodeBlock().run()}
      editor={editor}
      type="codeBlock"
      tooltip="Code Block (⌘+⇧+⌥+c)"
      className={className}
      {...props}>
      <Icon type="RiCodeBlock" size={20} />
    </Button>
  )
}

CodeBlockButton.displayName = 'CodeBlockButton'
