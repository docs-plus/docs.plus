import type { Editor } from '@tiptap/core'

/** TipTap’s command typings omit extension commands on `editor.commands`; runtime is correct. */
export function setParagraphStyle(editor: Editor, style: 'normal' | 'subtitle'): boolean {
  return (
    editor.commands as typeof editor.commands & {
      setParagraphStyle: (s: 'normal' | 'subtitle') => boolean
    }
  ).setParagraphStyle(style)
}
