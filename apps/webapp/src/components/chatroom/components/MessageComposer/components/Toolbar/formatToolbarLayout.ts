import type { Placement } from '@floating-ui/react'
import type { ComponentType } from 'react'

import { MentionButton } from '../Actions/ActionButtons/MentionButton'
import {
  BlockquoteButton,
  BoldButton,
  BulletListButton,
  CodeBlockButton,
  CodeButton,
  HyperlinkButton,
  ItalicButton,
  OrderedListButton,
  StrikethroughButton
} from './ToolbarButtons'

export type FormatButtonProps = {
  size: number
  className?: string
  tooltipPosition?: Placement
}

export const FORMAT_TOOLBAR_GROUPS: ComponentType<FormatButtonProps>[][] = [
  [BoldButton, ItalicButton, StrikethroughButton, CodeButton],
  [HyperlinkButton, MentionButton],
  [BulletListButton, OrderedListButton],
  [BlockquoteButton, CodeBlockButton]
]

export const FORMAT_TOOLBAR_FLAT = FORMAT_TOOLBAR_GROUPS.flat()

export function formatToolbarButtonKey(
  Button: ComponentType<FormatButtonProps>,
  index: number
): string {
  return Button.displayName ?? Button.name ?? `format-${index}`
}
