import '../../link-icons/__tests__/setupDom'

import { Editor, type Extensions, Mark, Node } from '@tiptap/core'
import { history, redo, undo, undoDepth } from '@tiptap/pm/history'
import { Plugin } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'bun:test'

import { Hyperlink } from '../../hyperlink'
import { Doc, Paragraph, Text } from '../../link-icons/__tests__/minimalSchema'
import { enterKey } from '../../link-icons/linkIconEnter'

const Bold = Mark.create({
  name: 'bold',
  parseHTML: () => [{ tag: 'strong' }],
  renderHTML: () => ['strong', 0]
})
// Like StarterKit's code mark: it excludes every other mark on its own range.
const Code = Mark.create({
  name: 'code',
  excludes: '_',
  parseHTML: () => [{ tag: 'code' }],
  renderHTML: () => ['code', 0]
})
const History = Mark.create({
  name: 'historyHost',
  addProseMirrorPlugins: () => [history() as Plugin]
})

// The real list nodes live in @tiptap/extension-list, which this package does not install.
const BulletList = Node.create({
  name: 'bulletList',
  group: 'block',
  content: 'listItem+',
  parseHTML: () => [{ tag: 'ul' }],
  renderHTML: () => ['ul', 0]
})
const ListItem = Node.create({
  name: 'listItem',
  content: 'paragraph block*',
  defining: true,
  parseHTML: () => [{ tag: 'li' }],
  renderHTML: () => ['li', 0],
  addKeyboardShortcuts() {
    return { Enter: () => this.editor.commands.splitListItem(this.name) }
  }
})

const editors: Editor[] = []
function make(html: string, extra: Extensions = []): Editor {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      Doc,
      Paragraph,
      Text,
      Bold,
      Code,
      History,
      ...extra,
      Hyperlink.configure({ autolink: true })
    ],
    content: html
  })
  editors.push(editor)
  return editor
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()))

// One entry per text character: the href it carries, or '' when it is not linked.
function hrefs(editor: Editor): string[] {
  const out: string[] = []
  editor.state.doc.descendants((n) => {
    if (n.isText)
      for (const _ of n.text!)
        out.push(n.marks.find((m) => m.type.name === 'hyperlink')?.attrs.href ?? '')
  })
  return out
}
const addMark = (e: Editor, name: string, from: number, to: number) =>
  e.view.dispatch(e.state.tr.addMark(from, to, e.schema.marks[name].create()))

const HREF = 'https://example.com'
const LINK = `<p><a href="${HREF}">example.com</a></p>`
const all = (n: number, href = HREF) => Array(n).fill(href)

describe('autolink keeps a link that another mark splits', () => {
  for (const [from, to] of [
    [1, 5],
    [5, 9],
    [3, 7],
    [8, 12]
  ]) {
    it(`bold over ${from}-${to} keeps every character linked`, () => {
      const e = make(LINK)
      addMark(e, 'bold', from, to)
      expect(hrefs(e)).toEqual(all(11))
    })
  }

  it('bold over parts of two links keeps both links whole', () => {
    const e = make(
      `<p><a href="${HREF}">example.com</a> and <a href="https://foo.org">foo.org</a></p>`
    )
    addMark(e, 'bold', 5, 21)
    expect(hrefs(e)).toEqual([...all(11), ...all(5, ''), ...all(7, 'https://foo.org')])
  })

  it('code removes the link only where the code mark lands', () => {
    const e = make(LINK)
    addMark(e, 'code', 5, 9)
    expect(hrefs(e)).toEqual([...all(4), ...all(4, ''), ...all(3)])
  })

  it('typing inside an already split link keeps it whole', () => {
    const e = make(`<p><a href="${HREF}"><strong>exam</strong>ple.com</a></p>`)
    e.view.dispatch(e.state.tr.insertText('x', 8))
    expect(hrefs(e)).toEqual(all(12))
  })

  it('a custom label stays linked when part of it is bold', () => {
    const e = make(`<p><a href="${HREF}">click here</a></p>`)
    addMark(e, 'bold', 3, 7)
    expect(hrefs(e)).toEqual(all(10))
  })
})

describe('autolink still unlinks text that stops being a URL', () => {
  it('deleting ".com" from a plain link removes the link', () => {
    const e = make(LINK)
    e.view.dispatch(e.state.tr.delete(8, 12))
    expect(hrefs(e)).toEqual(all(7, ''))
  })

  it('deleting "com" from a split link removes the link', () => {
    const e = make(`<p><a href="${HREF}">exam<strong>ple.</strong>com</a></p>`)
    e.view.dispatch(e.state.tr.delete(9, 12))
    expect(hrefs(e)).toEqual(all(8, ''))
  })
})

describe('autolink leaves alone what it does not own', () => {
  // Matches upstream @tiptap/extension-link: the label still holds a URL, so the link stays.
  it('typing a space inside a link keeps the whole link', () => {
    const e = make(LINK)
    e.view.dispatch(e.state.tr.insertText(' ', 5))
    expect(hrefs(e)).toEqual(all(12))
  })

  // A label that looks like a URL may point somewhere else. Autolink must not rewrite that target.
  const CUSTOM = 'https://other.example/x'
  const CUSTOM_LINK = `<p><a href="${CUSTOM}">example.com</a> after</p>`

  it('a space after a link keeps its custom href', () => {
    const e = make(CUSTOM_LINK)
    e.view.dispatch(e.state.tr.insertText(' ', 12))
    expect(hrefs(e).slice(0, 11)).toEqual(all(11, CUSTOM))
  })

  it('bold over a link and the space after it keeps its custom href', () => {
    const e = make(CUSTOM_LINK)
    addMark(e, 'bold', 1, 13)
    expect(hrefs(e).slice(0, 11)).toEqual(all(11, CUSTOM))
  })

  it('a URL typed after a link gets its own link, and the first keeps its href', () => {
    const e = make(`<p><a href="${CUSTOM}">example.com</a></p>`)
    e.view.dispatch(e.state.tr.insertText(' foo.org ', 12))
    expect(hrefs(e)).toEqual([...all(11, CUSTOM), '', ...all(7, 'https://foo.org'), ''])
  })
})

// Ruled on #778 (option B): both halves keep the old target, as in upstream @tiptap/extension-link.
describe('Enter inside a link', () => {
  const pressEnter = (e: Editor, pos: number) => {
    e.commands.setTextSelection(pos)
    return e.view.someProp('handleKeyDown', (f) => f(e.view, enterKey()))
  }
  const paragraphs = (e: Editor) => {
    const out: string[] = []
    e.state.doc.forEach((block) => out.push(block.textContent))
    return out
  }
  const CUSTOM = 'https://other.example/x'

  for (const [name, html, text, href] of [
    ['example.com', LINK, 'example.com', HREF],
    ['a "click here" label', `<p><a href="${HREF}">click here</a></p>`, 'click here', HREF],
    [
      'a link with a bold part',
      `<p><a href="${HREF}"><strong>exam</strong>ple.com</a></p>`,
      'example.com',
      HREF
    ],
    ['a custom href', `<p><a href="${CUSTOM}">example.com</a></p>`, 'example.com', CUSTOM]
  ]) {
    for (const pos of [1, 3, 5, 8, 10]) {
      it(`at ${pos} in ${name} keeps both halves linked, and one undo restores the link`, () => {
        const e = make(html)
        const before = e.getHTML()
        expect(pressEnter(e, pos)).toBe(true)
        expect(paragraphs(e)).toEqual([text.slice(0, pos - 1), text.slice(pos - 1)])
        expect(hrefs(e)).toEqual(all(text.length, href))
        expect(undoDepth(e.state)).toBe(1)
        undo(e.state, e.view.dispatch)
        expect(e.getHTML()).toBe(before)
        expect(paragraphs(e)).toEqual([text])
        expect(hrefs(e)).toEqual(all(text.length, href))
      })
    }
  }

  it('in a list item keeps both halves linked, and one undo restores the link', () => {
    const e = make(`<ul><li>${LINK}</li></ul>`, [BulletList, ListItem])
    const items = () => {
      const out: string[] = []
      e.state.doc.firstChild!.forEach((item) => out.push(item.textContent))
      return out
    }
    const before = e.getHTML()
    // ul, li and p each open one position, so the text starts at 3 and `exam|ple.com` is 7.
    expect(pressEnter(e, 7)).toBe(true)
    expect(items()).toEqual(['exam', 'ple.com'])
    expect(hrefs(e)).toEqual(all(11))
    expect(undoDepth(e.state)).toBe(1)
    undo(e.state, e.view.dispatch)
    expect(e.getHTML()).toBe(before)
    expect(items()).toEqual(['example.com'])
    expect(hrefs(e)).toEqual(all(11))
  })
})

describe('undo and redo of a partial format', () => {
  it('one undo step gives back plain text with the whole link', () => {
    const e = make(LINK)
    addMark(e, 'bold', 5, 9)
    expect(undoDepth(e.state)).toBe(1)
    undo(e.state, e.view.dispatch)
    expect(e.getHTML()).not.toContain('<strong>')
    expect(hrefs(e)).toEqual(all(11))
  })

  it('redo gives back the bold with the whole link', () => {
    const e = make(LINK)
    addMark(e, 'bold', 5, 9)
    undo(e.state, e.view.dispatch)
    redo(e.state, e.view.dispatch)
    expect(e.getHTML()).toContain('<strong>')
    expect(hrefs(e)).toEqual(all(11))
  })
})
