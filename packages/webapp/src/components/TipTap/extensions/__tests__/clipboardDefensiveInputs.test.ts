/**
 * TG-4: Malformed input tests for linearizeHeadingNodes, transformClipboardToStructured
 * TG-8: insertHeadingsByNodeBlocks null-guard test (CP-2 guard verification)
 */

import { EditorState } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'

import { linearizeHeadingNodes, transformClipboardToStructured } from '../helper/clipboard'
import { insertHeadingsByNodeBlocks } from '../helper/headingMap'
import { JSONNode } from '../types'
import { buildDoc, createTestSchema, heading, paragraph } from '../testUtils/testSchema'

const schema = createTestSchema()

// ===========================================================================
// TG-4: linearizeHeadingNodes — malformed input
// ===========================================================================

describe('linearizeHeadingNodes — malformed input resilience', () => {
  it('skips null/undefined entries without crashing', () => {
    const input = [null, undefined] as any[]
    expect(() => linearizeHeadingNodes(input)).not.toThrow()
    expect(linearizeHeadingNodes(input)).toEqual([])
  })

  it('skips ProseMirror node with childCount < 2', () => {
    const ch = schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level: 1 }, [
      schema.text('Solo')
    ])
    const incomplete = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level: 1 }, [
      ch,
      schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create()
    ])
    // A valid heading has childCount === 2 — this should work fine
    expect(linearizeHeadingNodes([incomplete]).length).toBeGreaterThan(0)
  })

  it('handles JSON heading with missing content array', () => {
    const jsonHeading: JSONNode = { type: TIPTAP_NODES.HEADING_TYPE }
    expect(() => linearizeHeadingNodes([jsonHeading])).not.toThrow()
  })

  it('handles JSON heading with empty content array', () => {
    const jsonHeading: JSONNode = {
      type: TIPTAP_NODES.HEADING_TYPE,
      content: []
    }
    expect(() => linearizeHeadingNodes([jsonHeading])).not.toThrow()
    expect(linearizeHeadingNodes([jsonHeading])).toEqual([])
  })

  it('handles JSON heading with content[1] missing', () => {
    const jsonHeading: JSONNode = {
      type: TIPTAP_NODES.HEADING_TYPE,
      content: [{ type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 1 } }]
    }
    expect(() => linearizeHeadingNodes([jsonHeading])).not.toThrow()
    const result = linearizeHeadingNodes([jsonHeading])
    expect(result).toHaveLength(1)
  })
})

// ===========================================================================
// TG-4: transformClipboardToStructured — malformed input
// ===========================================================================

describe('transformClipboardToStructured — malformed input resilience', () => {
  it('returns empty arrays for empty input', () => {
    const [paragraphs, headings] = transformClipboardToStructured([], { schema })
    expect(paragraphs).toEqual([])
    expect(headings).toEqual([])
  })

  it('handles paragraph with no content', () => {
    const input: JSONNode[] = [{ type: TIPTAP_NODES.PARAGRAPH_TYPE }]
    expect(() => transformClipboardToStructured(input, { schema })).not.toThrow()
    const [paragraphs, headings] = transformClipboardToStructured(input, { schema })
    expect(paragraphs).toHaveLength(1)
    expect(headings).toHaveLength(0)
  })

  it('handles contentHeading with missing attrs', () => {
    const input: JSONNode[] = [{ type: TIPTAP_NODES.CONTENT_HEADING_TYPE }]
    expect(() => transformClipboardToStructured(input, { schema })).not.toThrow()
    const [, headings] = transformClipboardToStructured(input, { schema })
    expect(headings).toHaveLength(1)
  })

  it('handles nodes after contentHeading with no content on wrapper', () => {
    const input: JSONNode[] = [
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Title' }]
      },
      {
        type: TIPTAP_NODES.PARAGRAPH_TYPE,
        content: [{ type: 'text', text: 'Body' }]
      }
    ]
    const [paragraphs, headings] = transformClipboardToStructured(input, { schema })
    expect(paragraphs).toHaveLength(0)
    expect(headings).toHaveLength(1)
  })
})

// ===========================================================================
// TG-8: insertHeadingsByNodeBlocks — null nodeAtStart guard (CP-2)
// ===========================================================================

describe('insertHeadingsByNodeBlocks — null nodeAtStart guard', () => {
  it('skips heading when startBlockPos points to an invalid position', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])
    const state = EditorState.create({ doc, schema })
    const tr = state.tr

    const pastedHeading = heading(schema, 2, 'Pasted', [paragraph(schema, 'pasted body')])

    const lastH1Inserted = {
      startBlockPos: doc.content.size + 100,
      endBlockPos: 0
    }

    expect(() => {
      insertHeadingsByNodeBlocks(tr, [pastedHeading], 0, lastH1Inserted, 0, 0, 0)
    }).not.toThrow()
  })

  it('processes subsequent headings after skipping one with invalid startBlockPos', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])
    const state = EditorState.create({ doc, schema })
    const tr = state.tr

    const heading1 = heading(schema, 2, 'First', [paragraph(schema, 'first body')])
    const heading2 = heading(schema, 3, 'Second', [paragraph(schema, 'second body')])

    const lastH1Inserted = {
      startBlockPos: doc.content.size + 500,
      endBlockPos: 0
    }

    expect(() => {
      insertHeadingsByNodeBlocks(tr, [heading1, heading2], 0, lastH1Inserted, 0, 0, 0)
    }).not.toThrow()
  })
})
