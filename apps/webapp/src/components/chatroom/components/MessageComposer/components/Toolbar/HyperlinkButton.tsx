import { snapshotComposerLinkSelection } from '@components/chatroom/components/MessageComposer/stores/composerLinkSelectionRef'
import { Icons } from '@icons'

import { useMessageComposer } from '../../hooks'
import Button from '../ui/Button'
import type { FormatButtonProps } from './formatToolbarLayout'

export const HyperlinkButton = ({ size, ...props }: FormatButtonProps) => {
  const { editor } = useMessageComposer()
  const active = Boolean(editor?.isActive('hyperlink'))

  return (
    <Button
      onPointerDown={(e) => {
        e.preventDefault()
        if (editor) snapshotComposerLinkSelection(editor)
      }}
      onPress={() => editor?.commands.openCreateHyperlinkPopover()}
      isActive={active}
      aria-label="Hyperlink"
      tooltip="Hyperlink (⌘+K)"
      {...props}>
      <Icons.link size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}

HyperlinkButton.displayName = 'HyperlinkButton'
