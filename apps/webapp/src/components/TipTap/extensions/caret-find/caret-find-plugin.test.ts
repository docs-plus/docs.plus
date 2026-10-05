import { Schema, Slice } from '@tiptap/pm/model'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'

import {
  caretFindPluginKey,
  createCaretFindPlugin,
  openFindTr,
  setFindQueryTr,
  stepFindTr
} from './caret-find-plugin'

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', toDOM: () => ['p', 0] },
    text: {}
  }
})

describe('caret find plugin', () => {
  it('keeps the current index through a whole-document replace', () => {
    const lines = Array.from({ length: 12 }, (_, i) =>
      schema.node('paragraph', null, schema.text(`line ${i} apple`))
    )
    let state = EditorState.create({
      doc: schema.node('doc', null, lines),
      plugins: [createCaretFindPlugin()]
    })
    const run = (fn: (state: EditorState, tr: Transaction) => unknown) => {
      const tr = state.tr
      fn(state, tr)
      state = state.apply(tr)
    }

    run(openFindTr)
    run((s, tr) => setFindQueryTr(s, tr, 'apple'))
    for (let i = 0; i < 6; i++) run((s, tr) => stepFindTr(s, tr, 1))
    expect(caretFindPluginKey.getState(state)?.current).toBe(6)

    // y-tiptap replaces the whole document on a remote change, then restores the caret.
    const { from } = state.selection
    const tr = state.tr.replace(0, state.doc.content.size, new Slice(state.doc.content, 0, 0))
    tr.setSelection(TextSelection.create(tr.doc, from))
    state = state.apply(tr)

    const find = caretFindPluginKey.getState(state)
    expect(find?.hits).toHaveLength(12)
    expect(find?.current).toBe(6)
  })
})
