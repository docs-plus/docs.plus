import '../../link-icons/__tests__/setupDom'

import { afterEach, describe, expect, it } from 'bun:test'
import { Editor, Mark, Node } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { resetDefaultController } from '../../floating-popover'
import { Hyperlink } from '../../hyperlink'
import editHyperlinkPopover from '../editHyperlinkPopover'

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0]
})
const Text = Node.create({ name: 'text', group: 'inline' })
const Bold = Mark.create({
  name: 'bold',
  parseHTML: () => [{ tag: 'strong' }],
  renderHTML: () => ['strong', 0]
})

const editors: Editor[] = []
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
  document.body.replaceChildren()
  resetDefaultController()
})

const linkRange = (editor: Editor) => {
  let found: { from: number; to: number } | undefined
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.marks.some((m) => m.type.name === 'hyperlink')) return
    found = found
      ? { from: found.from, to: pos + node.nodeSize }
      : { from: pos, to: pos + node.nodeSize }
  })
  if (!found) throw new Error('no hyperlink text')
  return found
}

// Opens the form with the caret in the link, as a click does.
function openForm() {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [Doc, Paragraph, Text, Bold, Hyperlink],
    content: '<p>see <a href="https://old.example">docs page</a> here</p>'
  })
  editors.push(editor)
  editor.commands.setTextSelection(linkRange(editor).from + 1)
  const link = editor.view.dom.querySelector('a')!
  const form = editHyperlinkPopover({ editor, link }) as HTMLFormElement
  const [textInput, hrefInput] = Array.from(form.querySelectorAll('input'))
  return { editor, form, textInput, hrefInput }
}

// A co-editor renames the link and bolds its first word while the form is open.
function coEditorRenames(editor: Editor) {
  const { from, to } = linkRange(editor)
  const { schema } = editor.state
  const link = schema.marks.hyperlink.create({ href: 'https://old.example' })
  const tr = editor.state.tr.replaceWith(from, to, schema.text('fresh text', [link]))
  tr.addMark(from, from + 5, schema.marks.bold.create())
  // y-tiptap keeps the caret on the link through a remote change.
  tr.setSelection(TextSelection.create(tr.doc, from + 1))
  editor.view.dispatch(tr)
}

const submit = (form: HTMLFormElement) =>
  form.dispatchEvent(new Event('submit', { cancelable: true }))

describe('editHyperlinkPopover Apply', () => {
  it("keeps a co-editor's link text and marks when only the URL changed", () => {
    const { editor, form, hrefInput } = openForm()
    coEditorRenames(editor)
    hrefInput.value = 'https://new.example'
    submit(form)

    expect(editor.state.doc.textContent).toBe('see fresh text here')
    const { from } = linkRange(editor)
    const first = editor.state.doc.nodeAt(from)!
    expect(first.text).toBe('fresh')
    expect(first.marks.map((m) => m.type.name).sort()).toEqual(['bold', 'hyperlink'])
    expect(first.marks.find((m) => m.type.name === 'hyperlink')!.attrs.href).toBe(
      'https://new.example'
    )
  })

  it('replaces the link text when the user edited the Text field', () => {
    const { editor, form, textInput, hrefInput } = openForm()
    coEditorRenames(editor)
    textInput.value = 'typed name'
    hrefInput.value = 'https://new.example'
    submit(form)

    expect(editor.state.doc.textContent).toBe('see typed name here')
  })
})
