import { TIPTAP_NODES } from '@types'

import { collectHeadings } from './collectHeadings'

const makeEditor = (
  nodes: Array<{ type: string; text: string; level?: number; tocId?: string }>
) => {
  const doc = {
    descendants: (cb: (node: any) => boolean | void) => {
      for (const n of nodes) {
        cb({
          type: { name: n.type },
          textContent: n.text,
          attrs: { 'toc-id': n.tocId, level: n.level ?? 0 }
        })
      }
    }
  }
  return { state: { doc } } as any
}

describe('collectHeadings', () => {
  it('skips non-heading nodes', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.PARAGRAPH_TYPE, text: 'plain' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Title', level: 1, tocId: 'h1' }
    ])
    const out = collectHeadings(editor)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'h1', title: 'Title', level: 1 })
  })

  it('skips headings without a toc-id or with empty text', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'No ID', level: 1, tocId: undefined },
      { type: TIPTAP_NODES.HEADING_TYPE, text: '', level: 2, tocId: 'h-blank' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Kept', level: 2, tocId: 'h-keep' }
    ])
    expect(collectHeadings(editor)).toHaveLength(1)
  })

  it('builds a breadcrumb of slug ancestors for each heading', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Intro', level: 1, tocId: 'a' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Setup', level: 2, tocId: 'b' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Run Tests', level: 3, tocId: 'c' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Conclusion', level: 1, tocId: 'd' }
    ])
    const out = collectHeadings(editor)
    expect(out.map((h) => h.breadcrumb)).toEqual([
      ['intro'],
      ['intro', 'setup'],
      ['intro', 'setup', 'run-tests'],
      ['conclusion']
    ])
  })

  it('truncates breadcrumb when level decreases', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'A', level: 1, tocId: 'a' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'B', level: 3, tocId: 'b' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'C', level: 2, tocId: 'c' }
    ])
    const out = collectHeadings(editor)
    expect(out[2]).toMatchObject({ id: 'c', breadcrumb: ['a', 'c'] })
  })
})
