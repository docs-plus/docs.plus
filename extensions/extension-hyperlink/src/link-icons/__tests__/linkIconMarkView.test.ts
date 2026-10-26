import './setupDom'

import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { Editor, Node } from '@tiptap/core'
import { DOMParser as PMDOMParser, DOMSerializer, type Mark } from '@tiptap/pm/model'

import { Hyperlink } from '../../hyperlink'
import type { LinkIconResolver } from '../types'

// Not StarterKit: its types bring @tiptap/extension-link's setLink into this
// typecheck project, which clashes with the package's own setLink alias.
const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0]
})
const Text = Node.create({ name: 'text', group: 'inline' })
// An inline image parsed from img[src] at default priority, as a host image node would be.
const InlineImage = Node.create({
  name: 'image',
  inline: true,
  group: 'inline',
  addAttributes: () => ({ src: { default: null } }),
  parseHTML: () => [{ tag: 'img[src]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', HTMLAttributes]
})

let calls: string[] = []
const resolver: LinkIconResolver = ({ href }) => {
  calls.push(href)
  if (!href.startsWith('https:')) return null
  const img = document.createElement('img')
  img.src = 'https://icons.example/icon.png'
  img.hidden = true
  return img
}

const editors: Editor[] = []
function makeEditor(content: string, linkIcon: LinkIconResolver | null = resolver): Editor {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      Doc,
      Paragraph,
      Text,
      InlineImage,
      Hyperlink.configure({
        linkIcon: linkIcon ?? undefined,
        popovers: { previewHyperlink: () => document.createElement('div') }
      })
    ],
    content
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
  document.body.replaceChildren()
  calls = []
})

const flush = (editor: Editor): void => (editor.view as any).domObserver.flush()
const links = (editor: Editor): HTMLAnchorElement[] =>
  Array.from(editor.view.dom.querySelectorAll('a'))
const iconOf = (a: Element): Element | null => a.querySelector(':scope > .hyperlink-icon')
const imageCount = (editor: Editor): number => {
  let n = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image') n++
  })
  return n
}
const linkRange = (editor: Editor): { from: number; to: number; mark: Mark } => {
  let found: { from: number; to: number; mark: Mark } | undefined
  editor.state.doc.descendants((node, pos) => {
    const mark = node.marks.find((m) => m.type.name === 'hyperlink')
    if (!found && node.isText && mark) found = { from: pos, to: pos + node.nodeSize, mark }
  })
  if (!found) throw new Error('no hyperlink text')
  return found
}
const directText = (a: Element): boolean => Array.from(a.childNodes).some((n) => n.nodeType === 3)
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const MID = '<p>pre <a href="https://a.example">mid</a> post</p>'

describe('linkIconMarkView', () => {
  it('ignores icon attribute changes, so a loading icon rebuilds no link', () => {
    const editor = makeEditor(
      '<p><a href="https://a.example">one</a> and <a href="https://b.example">two</a></p>'
    )
    const before = links(editor)
    const icons = before.map(iconOf)
    const count = calls.length
    expect(icons.every(Boolean)).toBe(true)
    for (const icon of icons) (icon as HTMLElement).hidden = false
    flush(editor)
    const after = links(editor)
    expect(after.length).toBe(before.length)
    expect(after.every((a, i) => a === before[i] && iconOf(a) === icons[i])).toBe(true)
    expect(calls.length).toBe(count)
  })

  it('never turns an icon into an Image node on parse or paste', () => {
    const editor = makeEditor(
      '<p>x <a href="https://a.example">one</a> <img src="https://real.example/i.png"> y</p>'
    )
    expect(imageCount(editor)).toBe(1)
    // A clone has no view descs, as after a native split.
    const wrap = document.createElement('div')
    wrap.append(editor.view.dom.querySelector('p')!.cloneNode(true))
    let parsed = 0
    PMDOMParser.fromSchema(editor.schema)
      .parse(wrap)
      .descendants((node) => {
        if (node.type.name === 'image') parsed++
      })
    expect(parsed).toBe(1)

    const html = links(editor)[0].outerHTML
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.view.pasteHTML(html, new Event('paste') as ClipboardEvent)
    expect(links(editor).length).toBe(2)
    expect(imageCount(editor)).toBe(1)
  })

  it('blanks a javascript: href and never passes it to linkIcon', () => {
    const editor = makeEditor('<p>start</p>')
    const end = editor.state.doc.content.size - 1
    const { tr, schema } = editor.state
    tr.insertText('bad', end).addMark(
      end,
      end + 3,
      schema.marks.hyperlink.create({ href: 'javascript:alert(1)' })
    )
    editor.view.dispatch(tr)
    const [a] = links(editor)
    expect(a.getAttribute('href')).toBe('')
    expect(iconOf(a)).toBeNull()
    expect(calls).not.toContain('javascript:alert(1)')
  })

  it('keeps the same <a> and icon on a metadata write, and redraws on a new href', () => {
    const editor = makeEditor(MID)
    const [a] = links(editor)
    const icon = iconOf(a)
    const count = calls.length
    const write = (attrs: Record<string, unknown>): void => {
      const { from, to, mark } = linkRange(editor)
      const type = mark.type
      editor.view.dispatch(
        editor.state.tr
          .removeMark(from, to, type)
          .addMark(from, to, type.create({ ...mark.attrs, ...attrs }))
      )
    }

    write({ title: 'Title' })
    expect(links(editor)[0]).toBe(a)
    expect(iconOf(a)).toBe(icon)
    expect(a.getAttribute('title')).toBe('Title')
    expect(calls.length).toBe(count)

    write({ title: null })
    expect(links(editor)[0]).toBe(a)
    expect(a.hasAttribute('title')).toBe(false)

    write({ href: 'https://b.example' })
    expect(links(editor)[0]).not.toBe(a)
    expect(links(editor)[0].getAttribute('href')).toBe('https://b.example')
  })

  describe('keeps typed order when text lands in the <a> outside its text span', () => {
    const cases = [
      { index: 0, text: 'pre ABCmid post' },
      { index: 1, text: 'pre ABCmid post' },
      { index: 2, text: 'pre midABC post' }
    ]
    for (const { index, text } of cases) {
      it(`at child index ${index}`, () => {
        const editor = makeEditor(MID)
        const [a] = links(editor)
        const typed = document.createTextNode('A')
        a.insertBefore(typed, a.childNodes[index] ?? null)
        document.getSelection()!.collapse(typed, 1)
        flush(editor)
        editor.view.dispatch(editor.state.tr.insertText('B'))
        editor.view.dispatch(editor.state.tr.insertText('C'))
        expect(editor.state.doc.textContent).toBe(text)
        const caret = text.indexOf('C') + 2 // doc start + paragraph open
        expect(editor.state.selection.from).toBe(caret)
        expect(directText(links(editor)[0])).toBe(false)
      })
    }

    it('with two strays before the icon', () => {
      const editor = makeEditor(MID)
      const [a] = links(editor)
      a.insertBefore(document.createTextNode('A'), a.firstChild)
      a.insertBefore(document.createTextNode('B'), iconOf(a))
      flush(editor)
      expect(editor.state.doc.textContent).toBe('pre ABmid post')
      expect(directText(links(editor)[0])).toBe(false)
    })
  })

  describe('puts the caret back next to an element stray', () => {
    const textSpan = (a: Element): Element => a.querySelector(':scope > span:not(.hyperlink-icon)')!

    it('after the text span, without a throw', () => {
      const editor = makeEditor(MID)
      const [a] = links(editor)
      a.append(document.createElement('br'))
      document.getSelection()!.collapse(a, 3)
      expect(() => flush(editor)).not.toThrow()
      const sel = document.getSelection()!
      expect(textSpan(links(editor)[0]).contains(sel.anchorNode)).toBe(true)
    })

    it('before the icon, outside the hole', () => {
      const editor = makeEditor(MID)
      const [a] = links(editor)
      const stray = document.createElement('b')
      stray.textContent = 'Q'
      a.insertBefore(stray, a.firstChild)
      document.getSelection()!.collapse(a, 1)
      flush(editor)
      const sel = document.getSelection()!
      expect(sel.anchorNode === a).toBe(false)
      expect(textSpan(links(editor)[0]).contains(sel.anchorNode)).toBe(true)
    })
  })

  it('clears held sweeps when one throws after a composition', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const getSelection = document.getSelection
    try {
      const editor = makeEditor(MID)
      const view = editor.view as any
      view.input.composing = true
      const [a] = links(editor)
      a.insertBefore(document.createTextNode('A'), a.firstChild)
      flush(editor)
      let reads = 0
      document.getSelection = () => {
        reads++
        throw new Error('boom')
      }
      const end = (): void => {
        view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
      }
      end()
      await Promise.resolve()
      expect(reads).toBe(1)
      expect(error).toHaveBeenCalledTimes(1)
      view.input.composing = false
      end() // a stale sweep would read the selection again
      await Promise.resolve()
      expect(reads).toBe(1)
    } finally {
      document.getSelection = getSelection
      error.mockRestore()
    }
  })

  it('keeps text composed in the <a> outside its text span', async () => {
    const editor = makeEditor(MID)
    const view = editor.view as any
    view.input.composing = true
    const [a] = links(editor)
    const typed = document.createTextNode('A')
    a.insertBefore(typed, a.firstChild)
    document.getSelection()!.collapse(typed, 1)
    flush(editor)
    view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'A' }))
    await Promise.resolve()
    await Promise.resolve()
    await sleep(40)
    flush(editor)
    expect(editor.state.doc.textContent.split('A').length - 1).toBe(1)
    expect(directText(links(editor)[0])).toBe(false)
  })

  it('puts back an icon that a native delete removed', () => {
    const editor = makeEditor(MID)
    const doc = editor.state.doc
    const [a] = links(editor)
    const icon = iconOf(a)!
    icon.remove()
    flush(editor)
    expect(links(editor)[0].firstChild).toBe(icon)
    expect(editor.state.doc.eq(doc)).toBe(true)
  })

  it('logs a bad linkIcon result once and leaves the links plain', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const five = [1, 2, 3, 4, 5].map((n) => `<a href="https://${n}.example">l${n}</a>`).join(' ')
      const throwing: LinkIconResolver = () => {
        throw new Error('boom')
      }
      let editor = makeEditor(`<p>${five}</p>`, throwing)
      expect(error).toHaveBeenCalledTimes(1)
      expect(links(editor).length).toBe(5)
      expect(editor.view.dom.querySelector('.hyperlink-icon')).toBeNull()

      const two = '<p><a href="https://1.example">a</a> <a href="https://2.example">b</a></p>'
      const connected = document.createElement('span')
      document.body.append(connected)
      error.mockClear()
      editor = makeEditor(two, () => connected)
      expect(error).toHaveBeenCalledTimes(1)
      expect(editor.view.dom.querySelector('.hyperlink-icon')).toBeNull()

      error.mockClear()
      editor = makeEditor(two, () => {
        const span = document.createElement('span')
        span.textContent = 'x'
        return span
      })
      expect(error).toHaveBeenCalledTimes(1)
      expect(editor.view.dom.querySelector('.hyperlink-icon')).toBeNull()
    } finally {
      error.mockRestore()
    }
  })

  it('puts the caret at the link start on an icon click', () => {
    const editor = makeEditor(MID)
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    const icon = iconOf(links(editor)[0])!
    icon.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, clientX: 500, clientY: 500 })
    )
    expect(editor.state.selection.from).toBe(linkRange(editor).from)
  })

  it('renders the default <a> when linkIcon is unset', () => {
    const editor = makeEditor(MID, null)
    const [a] = links(editor)
    expect(editor.view.dom.querySelector('.hyperlink-icon')).toBeNull()
    const { mark } = linkRange(editor)
    const { dom } = DOMSerializer.renderSpec(document, mark.type.spec.toDOM!(mark, true))
    const attrs = (el: Element): string[][] =>
      el.getAttributeNames().map((n) => [n, el.getAttribute(n) ?? ''])
    expect(attrs(a)).toEqual(attrs(dom as Element))
    expect(Array.from(a.childNodes).map((n) => n.nodeType)).toEqual([3])
  })
})
