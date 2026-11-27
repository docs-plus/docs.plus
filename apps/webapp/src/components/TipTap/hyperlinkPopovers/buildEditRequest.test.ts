import { getDefaultController, Hyperlink } from '@docs.plus/extension-hyperlink'
import type { SheetDataMap } from '@stores'
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

import { buildEditRequest } from './buildEditRequest'
import { buildLinkPreviewActions } from './linkPreviewActions'
import previewHyperlink from './previewHyperlink'

// The chat-link opener loads the Supabase client, which needs env this test does not set.
jest.mock('../../../services/openChatFromLink', () => ({ openChatFromLink: jest.fn() }))
jest.mock('./fetchMetadata', () => ({ fetchMetadata: jest.fn(() => Promise.resolve(null)) }))

const hrefs = (editor: Editor) => {
  const found: string[] = []
  editor.state.doc.descendants((node) => {
    const mark = node.marks.find((m) => m.type.name === 'hyperlink')
    if (mark) found.push(mark.attrs.href)
  })
  return found
}

let editor: Editor
afterEach(() => {
  getDefaultController().close()
  editor?.destroy()
  document.body.innerHTML = ''
})

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

// #696: phone Edit finds the shifted link after a co-editor types above it.
test('phone Edit finds the link after a co-editor types above it (#696)', () => {
  editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [Document, Paragraph, Text, Hyperlink],
    content: '<p>top</p><p>see <a href="https://old.example">docs</a> here</p>'
  })
  const link = editor.view.dom.querySelector('a')!
  const initialPos = editor.view.posAtDOM(link, 0)

  let editorPayload: SheetDataMap['linkEditor'] | undefined
  const actions = buildLinkPreviewActions({
    payload: { href: 'https://old.example', editor, nodePos: initialPos, link },
    destination: { kind: 'web' },
    closeSheet: jest.fn(),
    switchSheet: ((_sheet: string, data: SheetDataMap['linkEditor']) => {
      editorPayload = data
    }) as never,
    onCopySuccess: jest.fn()
  })

  // Co-editor inserts text above before user taps Edit, and more before tapping Update.
  editor.view.dispatch(editor.state.tr.insertText('remote line one ', 1))
  actions.find((a) => a.key === 'edit')!.onClick()
  expect(editorPayload?.initialText).toBe('docs')

  editor.view.dispatch(editor.state.tr.insertText('remote line two ', 1))
  expect(editorPayload!.onSubmit({ href: 'https://new.example' })).toBe(true)
  expect(hrefs(editor)).toEqual(['https://new.example'])
})

// #696: phone Remove finds the shifted link after a co-editor types above it.
test('phone Remove unlinks the shifted link after a co-editor types above it (#696)', () => {
  editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [Document, Paragraph, Text, Hyperlink],
    content: '<p>top</p><p>see <a href="https://old.example">docs</a> here</p>'
  })
  const link = editor.view.dom.querySelector('a')!
  const initialPos = editor.view.posAtDOM(link, 0)
  const closeSheet = jest.fn()

  const actions = buildLinkPreviewActions({
    payload: { href: 'https://old.example', editor, nodePos: initialPos, link },
    destination: { kind: 'web' },
    closeSheet,
    switchSheet: jest.fn() as never,
    onCopySuccess: jest.fn()
  })

  editor.view.dispatch(editor.state.tr.insertText('a co-editor typed above ', 1))
  actions.find((a) => a.key === 'remove')!.onClick()

  expect(hrefs(editor)).toEqual([])
  expect(closeSheet).toHaveBeenCalledTimes(1)
})

// #696: desktop Remove acts on the clicked link only, even if selection moved to another link
// and a co-editor shifted positions above it.
test('desktop Remove unlinks only the clicked link when selection moved and text shifted (#696)', () => {
  editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [Document, Paragraph, Text, Hyperlink],
    content:
      '<p>top</p><p><a href="https://first.example">first</a> and <a href="https://second.example">second</a></p>'
  })
  const [firstLink, secondLink] = Array.from(editor.view.dom.querySelectorAll('a'))
  const firstPos = editor.view.posAtDOM(firstLink, 0)

  const popover = previewHyperlink({
    editor,
    link: firstLink,
    nodePos: firstPos,
    attrs: { href: 'https://first.example' }
  } as never)!

  // Co-editor shifts both links down, and caret moves onto the second link while preview is open.
  editor.view.dispatch(editor.state.tr.insertText('co-editor shift ', 1))
  const secondPos = editor.view.posAtDOM(secondLink, 0)
  editor.commands.setTextSelection(secondPos + 1)

  popover.querySelector<HTMLButtonElement>('button.remove')!.click()

  expect(hrefs(editor)).toEqual(['https://second.example'])
})
