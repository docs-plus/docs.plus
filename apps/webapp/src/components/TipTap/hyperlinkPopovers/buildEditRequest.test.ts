import { Hyperlink } from '@docs.plus/extension-hyperlink'
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

import { buildEditRequest } from './buildEditRequest'

const hrefs = (editor: Editor) => {
  const found: string[] = []
  editor.state.doc.descendants((node) => {
    const mark = node.marks.find((m) => m.type.name === 'hyperlink')
    if (mark) found.push(mark.attrs.href)
  })
  return found
}

let editor: Editor
afterEach(() => editor.destroy())

// #643: a co-editor types above the link while the desktop Edit form is open.
test('Apply edits the link after text lands above it', () => {
  editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [Document, Paragraph, Text, Hyperlink],
    content: '<p>top</p><p>see <a href="https://old.example">docs</a> here</p>'
  })
  const link = editor.view.dom.querySelector('a')!
  const request = buildEditRequest({ editor, link, nodePos: editor.view.posAtDOM(link, 0) })

  editor.view.dispatch(editor.state.tr.insertText('a long line from a co-editor ', 1))

  expect(request.apply({ href: 'https://new.example' })).toBe(true)
  expect(hrefs(editor)).toEqual(['https://new.example'])
  expect(editor.state.doc.textContent).toBe('a long line from a co-editor topsee docs here')
})
