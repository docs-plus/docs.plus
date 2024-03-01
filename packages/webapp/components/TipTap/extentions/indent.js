// Sources:
//https://github.com/ueberdosis/tiptap/issues/1036#issuecomment-981094752
//https://github.com/django-tiptap/django_tiptap/blob/main/django_tiptap/templates/forms/tiptap_textarea.html#L453-L602

import { Extension } from '@tiptap/core'
import { TextSelection, AllSelection } from 'prosemirror-state'

export const clamp = (val, min, max) => {
  if (val < min) {
    return min
  }
  if (val > max) {
    return max
  }
  return val
}

const IndentProps = {
  min: 0,
  max: 210,

  more: 30,
  less: -30
}

export function isBulletListNode(node) {
  return node.type.name === 'bullet_list'
}

export function isOrderedListNode(node) {
  return node.type.name === 'order_list'
}

export function isTodoListNode(node) {
  return node.type.name === 'todo_list'
}

export function isListNode(node) {
  return isBulletListNode(node) || isOrderedListNode(node) || isTodoListNode(node)
}

const setNodeIndentMarkup = (tr, pos, delta) => {
  if (!tr.doc) return tr

  const node = tr.doc.nodeAt(pos)
  if (!node) return tr

  const minIndent = IndentProps.min
  const maxIndent = IndentProps.max

  const indent = clamp((node.attrs.indent || 0) + delta, minIndent, maxIndent)

  if (indent === node.attrs.indent) return tr

  const nodeAttrs = {
    ...node.attrs,
    indent
  }

  return tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks)
}

const updateIndentLevel = (tr, delta, options) => {
  const { doc, selection } = tr
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)

  if (!doc || !selection) return tr

  if (!(selection instanceof TextSelection || selection instanceof AllSelection)) {
    return tr
  }

  const { from, to } = selection

  console.log('from', options)

  doc.nodesBetween(start, to, (node, pos) => {
    const nodeType = node.type

    if (options.types.includes(node.type.name)) {
      tr = setNodeIndentMarkup(tr, pos, delta)
      return false
    }
    if (isListNode(node)) {
      return false
    }
    return true
  })

  return tr
}

export const Indent = Extension.create({
  name: 'indent',

  defaultOptions: {
    types: ['paragraph', 'listItem'],
    indentLevels: [0, 30, 60, 90, 120, 150, 180, 210],
    defaultIndentLevel: 0
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
              parseInt(element.style.marginLeft) || this.options.defaultIndentLevel
          }
        }
      }
    ]
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch, editor }) => {
          const { selection } = state
          tr = tr.setSelection(selection)
          tr = updateIndentLevel(tr, IndentProps.more, this.options)

          if (tr.docChanged) {
            // eslint-disable-next-line no-unused-expressions
            dispatch && dispatch(tr)
            return true
          }

          editor.chain().focus().run()

          return false
        },
      outdent:
        () =>
        ({ tr, state, dispatch, editor }) => {
          const { selection } = state
          tr = tr.setSelection(selection)
          tr = updateIndentLevel(tr, IndentProps.less, this.options)

          if (tr.docChanged) {
            // eslint-disable-next-line no-unused-expressions
            dispatch && dispatch(tr)
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
        if (!(this.editor.isActive('bulletList') || this.editor.isActive('orderedList')))
          return this.editor.commands.indent()
      },
      'Shift-Tab': () => {
        if (!(this.editor.isActive('bulletList') || this.editor.isActive('orderedList')))
          return this.editor.commands.outdent()
      }
    }
  }
})
