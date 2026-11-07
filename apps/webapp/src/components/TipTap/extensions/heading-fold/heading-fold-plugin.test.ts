import { getSchema } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { EditorState } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

import { createHeadingFoldPlugin, headingFoldPluginKey } from './heading-fold-plugin'

const TocHeading = Heading.extend({
  addAttributes() {
    return { ...this.parent?.(), 'toc-id': { default: null } }
  }
})
const schema = getSchema([Document, Paragraph, Text, TocHeading])

const doc = schema.nodeFromJSON({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2, 'toc-id': 'a' }, content: [{ type: 'text', text: 'A' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
    { type: 'heading', attrs: { level: 2, 'toc-id': 'b' }, content: [{ type: 'text', text: 'B' }] }
  ]
})

const freshState = () =>
  EditorState.create({
    doc,
    plugins: [createHeadingFoldPlugin({ documentId: 'test', initialFoldedIds: new Set() })]
  })

const mountView = (state: EditorState) => new EditorView(document.createElement('div'), { state })

const toggle = (view: EditorView) =>
  view.dispatch(view.state.tr.setMeta(headingFoldPluginKey, { type: 'toggle', id: 'a' }))

const foldOf = (view: EditorView) => {
  const state = headingFoldPluginKey.getState(view.state)!
  return { folded: state.foldedIds.has('a'), animating: state.animating.has('a') }
}

// Tiptap's unmount and mount build a new view from the same plugin. Each view must end its
// own fold animations, or `toggle` ignores the section from then on.
describe('heading fold across a view rebuild', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('folds and unfolds in a view built after another was destroyed', () => {
    const first = mountView(freshState())
    first.destroy()
    const view = mountView(first.state)

    toggle(view)
    jest.advanceTimersByTime(500)
    expect(foldOf(view)).toEqual({ folded: true, animating: false })

    toggle(view)
    jest.advanceTimersByTime(500)
    expect(foldOf(view)).toEqual({ folded: false, animating: false })
    view.destroy()
  })

  it('ends a fold that a rebuild cut off mid-animation', () => {
    const first = mountView(freshState())
    toggle(first)
    first.destroy()
    const view = mountView(first.state)

    jest.advanceTimersByTime(500)
    expect(foldOf(view)).toEqual({ folded: true, animating: false })
    view.destroy()
  })
})
