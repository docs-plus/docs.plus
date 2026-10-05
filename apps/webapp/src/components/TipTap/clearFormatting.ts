import { Extension } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    clearFormatting: {
      clearFormatting: () => ReturnType
    }
  }
}

const KEPT_MARKS = new Set(['hyperlink', 'link'])

const isKept = (type: MarkType) => KEPT_MARKS.has(type.name)

/**
 * Clears text marks only, like Google Docs and Word (#392). Links are content and stay.
 * Block style is outline, so it never touches nodes: a demoted heading loses its section.
 * Returns false when nothing can be cleared, so `can()` drives the disabled state.
 */
export const ClearFormatting = Extension.create({
  name: 'clearFormatting',

  addCommands() {
    return {
      clearFormatting:
        () =>
        ({ state, tr, dispatch }) => {
          const { selection, doc, schema } = state

          if (selection.empty) {
            const marks = state.storedMarks ?? selection.$from.marks()
            if (marks.every((mark) => isKept(mark.type))) return false
            // Never null: null re-inherits the caret's marks. Kept links stay, so typing inside a link does not split it.
            if (dispatch) tr.setStoredMarks(marks.filter((mark) => isKept(mark.type)))
            return true
          }

          // can() runs on every transaction. After the first clearable mark the walk skips every
          // child, so a long selection only touches its top-level nodes.
          let hasClearable = false
          for (const { $from, $to } of selection.ranges) {
            doc.nodesBetween($from.pos, $to.pos, (node) => {
              if (hasClearable) return false
              hasClearable = node.marks.some((mark) => !isKept(mark.type))
            })
          }
          if (!hasClearable) return false

          if (dispatch) {
            const types = Object.values(schema.marks).filter((type) => !isKept(type))
            for (const { $from, $to } of selection.ranges) {
              for (const type of types) tr.removeMark($from.pos, $to.pos, type)
            }
          }
          return true
        }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-\\': () => this.editor.commands.clearFormatting()
    }
  }
})
