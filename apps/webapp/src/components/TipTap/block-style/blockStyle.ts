import { isTitleSelected } from '@components/TipTap/extensions/title-document'
import type { Editor } from '@tiptap/core'

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type BlockStyle =
  | { kind: 'title' }
  | { kind: 'subtitle' }
  | { kind: 'heading'; level: HeadingLevel }
  | { kind: 'normal' }

export type BlockStyleApply = Exclude<BlockStyle, { kind: 'title' }>

export const isHeadingLevel = (value: unknown): value is HeadingLevel =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6

export function blockStyleOf(
  isTitle: boolean,
  nodeName: string,
  attrs: { level?: unknown; paragraphStyle?: unknown }
): BlockStyle {
  if (isTitle) return { kind: 'title' }
  if (nodeName === 'heading') {
    return { kind: 'heading', level: isHeadingLevel(attrs.level) ? attrs.level : 1 }
  }
  if (nodeName === 'paragraph' && attrs.paragraphStyle === 'subtitle') {
    return { kind: 'subtitle' }
  }
  return { kind: 'normal' }
}

export function readBlockStyle(editor: Editor): BlockStyle {
  const { $from } = editor.state.selection
  return blockStyleOf(isTitleSelected(editor), $from.parent.type.name, $from.parent.attrs)
}

export function headingStepHonesty(style: BlockStyle): {
  canStepDown: boolean
  canStepUp: boolean
} {
  if (style.kind !== 'heading') return { canStepDown: false, canStepUp: false }
  return {
    canStepDown: style.level > 1,
    canStepUp: style.level < 6
  }
}

export function applyBlockStyle(editor: Editor, next: BlockStyleApply): boolean {
  if (isTitleSelected(editor)) return false
  if (next.kind === 'heading') {
    return editor.chain().focus().setHeading({ level: next.level }).run()
  }
  return editor.commands.setParagraphStyle(next.kind === 'subtitle' ? 'subtitle' : 'normal')
}

export function stepHeadingLevel(editor: Editor, delta: number): boolean {
  const style = readBlockStyle(editor)
  if (style.kind !== 'heading') return false
  const next = style.level + delta
  if (!isHeadingLevel(next)) return false
  return applyBlockStyle(editor, { kind: 'heading', level: next })
}

export function toggleHeadingParagraph(editor: Editor, rememberedLevel: HeadingLevel): boolean {
  const style = readBlockStyle(editor)
  if (style.kind === 'title') return false
  if (style.kind === 'heading') return applyBlockStyle(editor, { kind: 'normal' })
  return applyBlockStyle(editor, { kind: 'heading', level: rememberedLevel })
}
