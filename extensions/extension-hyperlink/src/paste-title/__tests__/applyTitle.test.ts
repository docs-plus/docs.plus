import '../../link-icons/__tests__/setupDom'

import { afterEach, describe, expect, it } from 'bun:test'
import { Editor, Extension, Node } from '@tiptap/core'
import { history, undo } from '@tiptap/pm/history'

import { Hyperlink } from '../../hyperlink'
import { createLinkContext } from '../../interactions/createLinkContext'
import { applyTitle } from '../applyTitle'

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0]
})
const Text = Node.create({ name: 'text', group: 'inline' })
const History = Extension.create({ name: 'testHistory', addProseMirrorPlugins: () => [history()] })

const editors: Editor[] = []
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
})

function setup(html: string) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [Doc, Paragraph, Text, History, Hyperlink.configure({})],
    content: html
  })
  editors.push(editor)
  const ctx = createLinkContext({
    editor,
    type: editor.schema.marks.hyperlink,
    options: editor.extensionManager.extensions.find((e) => e.name === 'hyperlink')!.options
  })
  const link = editor.view.dom.querySelector('a') as HTMLAnchorElement
  return { editor, ctx, link }
}

const RAW = '<p>See <a href="https://example.com/a">https://example.com/a</a> now</p>'

describe('applyTitle', () => {
  it('swaps a raw URL for the cleaned page title, in one undoable step', () => {
    const { editor, ctx, link } = setup(RAW)
    const before = editor.getHTML()
    const apply = applyTitle(ctx, link, 'https://example.com/a', '  The\nPage  ')
    expect(apply).toBeDefined()
    expect(apply!()).toBe(true)
    expect(editor.getText()).toBe('See The Page now')
    expect(editor.getHTML()).toContain('href="https://example.com/a"')

    expect(undo(editor.state, editor.view.dispatch)).toBe(true)
    expect(editor.getHTML()).toBe(before)
  })

  it('leaves the editor focused with the caret after the title, so Mod-Z undoes it', async () => {
    const { editor, ctx, link } = setup(RAW)
    applyTitle(ctx, link, 'https://example.com/a', 'The Page')!()
    // "See " starts at 1, so the 8-character title ends at 13.
    expect(editor.state.selection.from).toBe(13)
    // Tiptap's focus command moves DOM focus on the next animation frame.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(document.activeElement).toBe(editor.view.dom)
  })

  it('offers nothing for a link with its own words', () => {
    const { ctx, link } = setup('<p><a href="https://example.com/a">our docs</a></p>')
    expect(applyTitle(ctx, link, 'https://example.com/a', 'The Page')).toBeUndefined()
  })

  it('offers nothing in a read-only editor or without a usable title', () => {
    const { editor, ctx, link } = setup(RAW)
    expect(applyTitle(ctx, link, 'https://example.com/a', 'paypal.com')).toBeUndefined()
    expect(applyTitle(ctx, link, 'https://example.com/a', undefined)).toBeUndefined()
    editor.setEditable(false)
    expect(applyTitle(ctx, link, 'https://example.com/a', 'The Page')).toBeUndefined()
  })

  it('does nothing when the text changed after the card opened', () => {
    const { editor, ctx, link } = setup(RAW)
    const apply = applyTitle(ctx, link, 'https://example.com/a', 'The Page')!
    // A co-editor's typing inside the link changes its text: the old answer must not land.
    editor.commands.insertContentAt(editor.view.posAtDOM(link, 0) + 3, 'x')
    expect(apply()).toBe(false)
    expect(editor.getText()).toContain('httxps://example.com/a')
  })
})
