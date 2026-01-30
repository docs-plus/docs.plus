import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks/indext'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}
export const CodeButton = ({ size = 16 }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().toggleInlineCode().run()}
      editor={editor}
      type="code"
      tooltip="Code Block (⌘+⇧+⌥+c)">
      <Icon type="MdCode" size={size} />
    </Button>
  )
}

CodeButton.displayName = 'CodeButton'
