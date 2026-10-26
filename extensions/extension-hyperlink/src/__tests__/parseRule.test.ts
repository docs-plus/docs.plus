import '../link-icons/__tests__/setupDom'

import { afterEach, describe, expect, it } from 'bun:test'
import { Editor, Mark, Node } from '@tiptap/core'

import { Hyperlink } from '../hyperlink'

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0]
})
const Text = Node.create({ name: 'text', group: 'inline' })
// Stands in for StarterKit's Link: same name, mark priority and a[href] rule at
// the default 50. The real package's types clash with this package's setLink.
const Link = Mark.create({
  name: 'link',
  priority: 1000,
  addAttributes: () => ({ href: { default: null } }),
  parseHTML: () => [{ tag: 'a[href]' }],
  renderHTML: ({ HTMLAttributes }) => ['a', HTMLAttributes, 0]
})

const editors: Editor[] = []
function makeEditor(content: string | object, onContentError?: () => void): Editor {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    // Link first, as in a host that lists StarterKit before Hyperlink.
    extensions: [Doc, Paragraph, Text, Link, Hyperlink],
    content,
    enableContentCheck: true,
    onContentError
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
  document.body.replaceChildren()
})

const markNames = (editor: Editor): string[] => {
  const names: string[] = []
  editor.state.doc.descendants((node) => {
    for (const mark of node.marks) names.push(mark.type.name)
  })
  return names
}

describe('a[href] parse rule beside a registered link mark', () => {
  it('parses HTML content as hyperlink', () => {
    const editor = makeEditor('<p><a href="https://example.com">site</a></p>')
    expect(markNames(editor)).toEqual(['hyperlink'])
  })

  it('pastes HTML as hyperlink', () => {
    const editor = makeEditor('<p>x</p>')
    // jsdom has no ClipboardEvent, so pass a plain paste event.
    const event = new Event('paste') as ClipboardEvent
    editor.view.pasteHTML('<a href="https://example.com">site</a>', event)
    expect(markNames(editor)).toEqual(['hyperlink'])
  })

  it('still loads a stored link mark', () => {
    let failed = false
    const editor = makeEditor(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'old',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]
              }
            ]
          }
        ]
      },
      () => {
        failed = true
      }
    )
    expect(failed).toBe(false)
    expect(markNames(editor)).toEqual(['link'])
  })
})

export {}
