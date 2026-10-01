import { applyBlockStyle, type BlockStyleApply } from '@components/TipTap/block-style/blockStyle'
import { dismissSoftKeyboard } from '@components/TipTap/hyperlinkPopovers/previewHyperlink'
import { Icons } from '@icons'
import { useSheetStore, useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import type { IconType } from 'react-icons'

import { insertMediaOpenRequest } from '../toolbar/desktop/popoverOpenRequest'
import type { SlashItem } from './slashMenuSession'

// One phone check for the sheet host and the Picture item, which switches away from that sheet.
export const isPhone = (): boolean => !!useStore.getState().settings.editor.isMobile

// Dry-run chains cannot see their own earlier steps, so `can()` on a chained command
// under-reports. Only a heading has a real limit: a list item must start with a paragraph.
const canApplyBlockStyle = (editor: Editor, style: BlockStyleApply): boolean =>
  style.kind === 'heading'
    ? editor.can().setHeading({ level: style.level }) ||
      editor.isActive('heading', { level: style.level })
    : editor.isActive('paragraph') || editor.can().setParagraph()

const always = (): boolean => true

const blockStyleItem = (
  id: string,
  label: string,
  icon: IconType,
  aliases: string[],
  style: BlockStyleApply
): SlashItem => ({
  id,
  label,
  icon,
  aliases,
  can: (editor) => canApplyBlockStyle(editor, style),
  run: (editor) => {
    applyBlockStyle(editor, style)
  }
})

const HEADING_ITEMS = ([1, 2, 3, 4, 5, 6] as const).map((level) =>
  blockStyleItem(`heading${level}`, `Heading ${level}`, Icons.heading, [`h${level}`], {
    kind: 'heading',
    level
  })
)

/** Names match the issue #251 list. Title, marks, Indent and tables stay out. */
const SLASH_ITEMS: SlashItem[] = [
  ...HEADING_ITEMS,
  blockStyleItem('subtitle', 'Subtitle', Icons.textFormat, [], { kind: 'subtitle' }),
  blockStyleItem('normal', 'Normal', Icons.textFormat, ['p', 'text', 'paragraph'], {
    kind: 'normal'
  }),
  {
    id: 'bulletList',
    label: 'Bullet list',
    icon: Icons.bulletList,
    aliases: ['ul'],
    can: always,
    run: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    id: 'orderedList',
    label: 'Ordered list',
    icon: Icons.orderedList,
    aliases: ['ol', 'numbered'],
    can: always,
    run: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    id: 'taskList',
    label: 'Task list',
    icon: Icons.taskList,
    aliases: ['todo', 'checkbox'],
    can: always,
    run: (editor) => editor.chain().focus().toggleTaskList().run()
  },
  {
    id: 'blockquote',
    label: 'Blockquote',
    icon: Icons.blockquote,
    aliases: ['quote'],
    can: always,
    run: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    icon: Icons.codeBlock,
    aliases: ['code', 'pre'],
    can: always,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    id: 'picture',
    label: 'Picture',
    icon: Icons.image,
    aliases: ['image', 'img', 'media', 'photo'],
    can: () => isPhone() || insertMediaOpenRequest.canRequest(),
    run: (editor) => {
      if (!isPhone()) {
        insertMediaOpenRequest.request()
        return
      }
      // Same order as the phone toolbar image button. The slash sheet is still up, so switch.
      dismissSoftKeyboard(editor)
      useSheetStore.getState().switchSheet('mediaInsert', { editor })
    }
  },
  {
    id: 'sectionLink',
    label: 'Link to a section',
    icon: Icons.link,
    aliases: ['link', 'url', 'section'],
    can: (editor) => editor.can().openCreateHyperlinkPopover(),
    run: (editor) => editor.chain().focus().openCreateHyperlinkPopover().run()
  }
]

const squash = (value: string): string => value.toLowerCase().replace(/\s+/g, '')

export function filterSlashItems(editor: Editor, query: string): SlashItem[] {
  const q = squash(query)
  return SLASH_ITEMS.filter(
    (item) =>
      (!q || squash(item.label).includes(q) || item.aliases.some((alias) => alias.startsWith(q))) &&
      item.can(editor)
  )
}
