import { Extension, Mark } from '@tiptap/core'
import { TextSelection, AllSelection, Transaction } from 'prosemirror-state'

export const clamp = (val: number, min: number, max: number): number => {
  return Math.min(Math.max(val, min), max)
}

interface IndentProps {
  min: number
  max: number
  more: number
  less: number
}

const IndentProps: IndentProps = {
  min: 0,
  max: 210,
  more: 30,
  less: -30
}

export function isBulletListNode(node: any): boolean {
  return node.type.name === 'bullet_list'
}

export function isOrderedListNode(node: any): boolean {
  return node.type.name === 'order_list'
}

export function isTodoListNode(node: any): boolean {
  return node.type.name === 'todo_list'
}

export function isListNode(node: any): boolean {
  return isBulletListNode(node) || isOrderedListNode(node) || isTodoListNode(node)
}

const setNodeIndentMarkup = (tr: Transaction, pos: number, delta: number): Transaction => {
  const node = tr.doc?.nodeAt(pos)
  if (!node) return tr

  const indent = clamp((node.attrs.indent || 0) + delta, IndentProps.min, IndentProps.max)
  if (indent === node.attrs.indent) return tr

  const nodeAttrs = { ...node.attrs, indent }
  return tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks)
}

const updateIndentLevel = (tr: Transaction, delta: number, options: any): Transaction => {
  const { doc, selection } = tr
  if (!doc || !selection) return tr
  if (!(selection instanceof TextSelection || selection instanceof AllSelection)) {
    return tr
  }

  const { start } = selection.$from.blockRange(selection.$to) as { start: number }
  doc.nodesBetween(start, selection.to, (node, pos) => {
    if (options.types.includes(node.type.name)) {
      tr = setNodeIndentMarkup(tr, pos, delta)
      return false
    }
    return !isListNode(node)
  })

  return tr
}

interface IndentOptions {
  types: string[]
  indentLevels: number[]
  defaultIndentLevel: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Indent: {
      /**
       *
       */
      indent: () => boolean

      /**
       *
       */
      outdent: () => boolean

      addKeyboardShortcuts(): {
        Tab: () => ReturnType
        'Shift-Tab': () => ReturnType
      }
    }
  }
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'listItem'],
      indentLevels: [0, 30, 60, 90, 120, 150, 180, 210],
      defaultIndentLevel: 0
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: this.options.defaultIndentLevel,
            renderHTML: (attributes) => ({
              style: `margin-left: ${attributes.indent}px!important;`
            }),
            parseHTML: (element) =>
              parseInt(element.style.marginLeft, 10) || this.options.defaultIndentLevel
          }
        }
      }
    ]
  },
  // @ts-ignore
  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch, editor }: any) => {
          tr = tr.setSelection(state.selection)
          tr = updateIndentLevel(tr, IndentProps.more, this.options)

          if (tr.docChanged) {
            dispatch?.(tr)
            return true
          }

          editor.chain().focus().run()
          return false
        },
      outdent:
        () =>
        ({ tr, state, dispatch, editor }: any) => {
          tr = tr.setSelection(state.selection)
          tr = updateIndentLevel(tr, IndentProps.less, this.options)

          if (tr.docChanged) {
            dispatch?.(tr)
            return true
          }

          editor.chain().focus().run()
          return false
        }
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!(this.editor.isActive('bulletList') || this.editor.isActive('orderedList'))) {
          return this.editor.commands.indent()
        }
        return false
      },
      'Shift-Tab': () => {
        if (!(this.editor.isActive('bulletList') || this.editor.isActive('orderedList'))) {
          return this.editor.commands.outdent()
        }
        return false
      }
    }
  }
})
