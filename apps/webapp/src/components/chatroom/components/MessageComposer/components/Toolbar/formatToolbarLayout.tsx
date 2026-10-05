import type { Placement } from '@floating-ui/react'
import { Icons } from '@icons'
import type { ChainedCommands } from '@tiptap/core'
import { twMerge } from '@utils/twMerge'
import type { ComponentType } from 'react'
import type { IconType } from 'react-icons'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import { MentionButton } from '../Actions/ActionButtons/MentionButton'
import Button from '../ui/Button'
import { HyperlinkButton } from './HyperlinkButton'

export type FormatButtonProps = {
  size: number
  className?: string
  tooltipPosition?: Placement
}

type FormatToggle = {
  name: string
  Icon: IconType
  label: string
  tooltip: string
  /** The mark or node name passed to `editor.isActive`. */
  type: string
  run: (chain: ChainedCommands) => ChainedCommands
}

function makeFormatToggle({ name, Icon, label, tooltip, type, run }: FormatToggle) {
  const FormatToggleButton = ({ size, ...props }: FormatButtonProps) => {
    const { editor } = useMessageComposer()
    const active = Boolean(editor?.isActive(type))

    return (
      <Button
        onPress={() => editor && run(editor.chain().focus()).run()}
        isActive={active}
        aria-label={label}
        aria-pressed={active}
        tooltip={tooltip}
        {...props}>
        <Icon size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
      </Button>
    )
  }
  FormatToggleButton.displayName = name
  return FormatToggleButton
}

// The composer Button has no house disabled ink, so set /40 over daisyUI's /20, as the pad ToolbarButton does.
const ClearFormattingButton = ({ size, className, ...props }: FormatButtonProps) => {
  const { editor } = useMessageComposer()

  return (
    <Button
      onPress={() => editor?.chain().focus().clearFormatting().run()}
      disabled={!editor?.can().clearFormatting()}
      aria-label="Clear formatting"
      tooltip={'Clear formatting (⌘+\\)'}
      className={twMerge('disabled:text-base-content/40', className)}
      {...props}>
      <Icons.clearFormatting size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}
ClearFormattingButton.displayName = 'ClearFormattingButton'

export const FORMAT_TOOLBAR_GROUPS: ComponentType<FormatButtonProps>[][] = [
  [
    makeFormatToggle({
      name: 'BoldButton',
      Icon: Icons.bold,
      label: 'Bold',
      tooltip: 'Bold (⌘+B)',
      type: 'bold',
      run: (chain) => chain.toggleBold()
    }),
    makeFormatToggle({
      name: 'ItalicButton',
      Icon: Icons.italic,
      label: 'Italic',
      tooltip: 'Italic (⌘+I)',
      type: 'italic',
      run: (chain) => chain.toggleItalic()
    }),
    makeFormatToggle({
      name: 'StrikethroughButton',
      Icon: Icons.strikethrough,
      label: 'Strikethrough',
      tooltip: 'Strikethrough (⌘+⇧+S)',
      type: 'strike',
      run: (chain) => chain.toggleStrike()
    }),
    makeFormatToggle({
      name: 'CodeButton',
      Icon: Icons.code,
      label: 'Inline code',
      tooltip: 'Inline code',
      type: 'inlineCode',
      run: (chain) => chain.toggleInlineCode()
    })
  ],
  [HyperlinkButton, MentionButton],
  [
    makeFormatToggle({
      name: 'BulletListButton',
      Icon: Icons.bulletList,
      label: 'Bullet list',
      tooltip: 'Bullet list (⌘+⇧+7)',
      type: 'bulletList',
      run: (chain) => chain.toggleBulletList()
    }),
    makeFormatToggle({
      name: 'OrderedListButton',
      Icon: Icons.orderedList,
      label: 'Numbered list',
      tooltip: 'Numbered list (⌘+⇧+8)',
      type: 'orderedList',
      run: (chain) => chain.toggleOrderedList()
    })
  ],
  [
    makeFormatToggle({
      name: 'BlockquoteButton',
      Icon: Icons.blockquote,
      label: 'Blockquote',
      tooltip: 'Blockquote (⌘+⇧+9)',
      type: 'blockquote',
      run: (chain) => chain.toggleBlockquote()
    }),
    makeFormatToggle({
      name: 'CodeBlockButton',
      Icon: Icons.codeBlock,
      label: 'Code block',
      tooltip: 'Code block',
      type: 'codeBlock',
      run: (chain) => chain.toggleCodeBlock()
    })
  ],
  [ClearFormattingButton]
]

export const FORMAT_TOOLBAR_FLAT = FORMAT_TOOLBAR_GROUPS.flat()

export function formatToolbarButtonKey(
  Button: ComponentType<FormatButtonProps>,
  index: number
): string {
  return Button.displayName ?? Button.name ?? `format-${index}`
}
