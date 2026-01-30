import Icon from '@components/TipTap/toolbar/Icon'

import { useMessageComposer } from '../../../hooks/indext'
import Button from '../../ui/Button'

type Props = {
  className?: string
  size?: number
}
export const HyperlinkButton = ({ className, size = 16, ...props }: Props) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      // @ts-ignore - setHyperlink is a valid command but TypeScript types aren't picking it up in Docker builds
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
