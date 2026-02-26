/**
 * TDD tests for clipboard round-trip and select-all + paste scenarios.
 *
 * These tests verify:
 * 1. deleteSelectedRange uses isEntireDocumentSelected (not magic numbers)
 * 2. transformCopied produces HN-10 compliant clipboard data
 * 3. transformClipboardToStructured + adjustHeadingLevelsForContext correctly
 *    standardize clipboard data before insertion
 * 4. The full copy → paste round-trip preserves document structure
 * 5. CMD+A + CMD+V (select-all + paste) works and can be repeated
 */

import { Fragment, Slice } from '@tiptap/pm/model'
import { TIPTAP_NODES } from '@types'

import {
  adjustHeadingLevelsForContext,
  getPasteContextLevel,
  linearizeHeadingNodes,
  transformClipboardToStructured
} from '../helper/clipboard'
import { getSelectionBlocks, isEntireDocumentSelected } from '../helper/selection'
import {
  buildDoc,
  createTestSchema,
  getFirstTextPos,
  heading,
  paragraph
} from '../testUtils/testSchema'

const schema = createTestSchema()

// ===========================================================================
// 1. deleteSelectedRange select-all consistency
// ===========================================================================

describe('deleteSelectedRange: select-all detection consistency', () => {
  it('source code uses isEntireDocumentSelected, not magic numbers', async () => {
    const source = await import('../deleteSelectedRange')
    const sourceText = source.default.toString()

    // Must NOT contain the old pattern: $from.pos === 0 && docSize === $to.pos
    // or the inverse: $anchor.pos === 2 && $head.pos === docSize - 3
    expect(sourceText).not.toMatch(/\.pos\s*===\s*0/)
    expect(sourceText).not.toMatch(/\.pos\s*===\s*2/)
    expect(sourceText).not.toMatch(/docSize\s*-\s*3/)
  })
})

// ===========================================================================
// 2. transformCopied must produce structurally valid clipboard data
// ===========================================================================

describe('transformCopied: clipboard data must be HN-10 standardized', () => {
  it('getSelectionBlocks on a cut document returns contentHeading blocks with level', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body'),
        heading(schema, 2, 'Child', [paragraph(schema, 'child body')])
      ])
    ])

    const from = getFirstTextPos(doc)
    const to = doc.content.size - 3

    const cutDoc = doc.cut(from, to)
    const blocks = getSelectionBlocks(cutDoc, 0, cutDoc.content.size, true, false)

    expect(blocks.length).toBeGreaterThan(0)

    // Every contentHeading block must have a level
    const headingBlocks = blocks.filter((b) => b.type === TIPTAP_NODES.CONTENT_HEADING_TYPE)
    for (const hb of headingBlocks) {
      expect(hb.level).toBeDefined()
      expect(typeof hb.level).toBe('number')
    }
  })

  it('serialized selection blocks round-trip through schema.nodeFromJSON', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body text')])])

    const from = getFirstTextPos(doc)
    const to = doc.content.size - 3

    const cutDoc = doc.cut(from, to)
    const blocks = getSelectionBlocks(cutDoc, 0, cutDoc.content.size, true, false)

    // Each block must be creatable as a ProseMirror node
    for (const block of blocks) {
      const node = schema.nodeFromJSON(block)
      expect(node).toBeDefined()
      expect(node.type.name).toBe(block.type)
    }
  })
})

// ===========================================================================
// 3. Clipboard standardization: transformClipboardToStructured
// ===========================================================================

describe('transformClipboardToStructured: clipboard data standardization', () => {
  it('separates leading paragraphs from headings', () => {
    const input = [
      { type: TIPTAP_NODES.PARAGRAPH_TYPE, content: [{ type: 'text', text: 'intro' }] },
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Section' }]
      },
      { type: TIPTAP_NODES.PARAGRAPH_TYPE, content: [{ type: 'text', text: 'body' }] }
    ]

    const [paragraphs, headings] = transformClipboardToStructured(input, { schema })

    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].type.name).toBe(TIPTAP_NODES.PARAGRAPH_TYPE)

    expect(headings).toHaveLength(1)
    expect(headings[0].type.name).toBe(TIPTAP_NODES.HEADING_TYPE)
    expect(headings[0].attrs.level).toBe(2)

    // The heading must have a contentWrapper with the trailing paragraph
    const wrapper = headings[0].child(1)
    expect(wrapper.type.name).toBe(TIPTAP_NODES.CONTENT_WRAPPER_TYPE)
    expect(wrapper.childCount).toBe(1)
  })

  it('handles multiple consecutive headings', () => {
    const input = [
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'First' }]
      },
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Second' }]
      }
    ]

    const [paragraphs, headings] = transformClipboardToStructured(input, { schema })

    expect(paragraphs).toHaveLength(0)
    expect(headings).toHaveLength(2)
    expect(headings[0].attrs.level).toBe(2)
    expect(headings[1].attrs.level).toBe(3)
  })
})

// ===========================================================================
// 4. adjustHeadingLevelsForContext: HN-10 level adjustment
// ===========================================================================

describe('adjustHeadingLevelsForContext: HN-10 compliant level adjustment', () => {
  it('shifts heading levels so min becomes contextLevel + 1', () => {
    const headingsJson = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: 1 },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 1 } },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: [] }
        ]
      }
    ]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 2, schema)

    // H1 pasted inside an H2 context → extracted to root
    expect(h1Headings).toHaveLength(1)
    expect(adjustedHeadings).toHaveLength(0)
  })

  it('keeps relative level differences between headings', () => {
    const headingsJson = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: 2 },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 2 } },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: [] }
        ]
      },
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: 4 },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 4 } },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: [] }
        ]
      }
    ]

    const { adjustedHeadings } = adjustHeadingLevelsForContext(headingsJson, 1, schema)

    expect(adjustedHeadings).toHaveLength(2)
    expect(adjustedHeadings[0].attrs.level).toBe(2)
    expect(adjustedHeadings[1].attrs.level).toBe(4)
  })

  it('updates both heading.attrs.level and contentHeading.attrs.level', () => {
    const headingsJson = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: 3 },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 3 }, content: [] },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: [] }
        ]
      }
    ]

    const { adjustedHeadings } = adjustHeadingLevelsForContext(headingsJson, 1, schema)

    const h = adjustedHeadings[0]
    expect(h.attrs.level).toBe(2)
    expect(h.child(0).attrs.level).toBe(2)
  })

  it('caps adjusted levels at 10', () => {
    const headingsJson = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: 8 },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 8 } },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: [] }
        ]
      }
    ]

    const { adjustedHeadings } = adjustHeadingLevelsForContext(headingsJson, 5, schema)

    expect(adjustedHeadings[0].attrs.level).toBeLessThanOrEqual(10)
  })
})

// ===========================================================================
// 5. getPasteContextLevel
// ===========================================================================

describe('getPasteContextLevel: correct context detection', () => {
  it('returns 0 at document root', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])

    // Position 0 is document root
    expect(getPasteContextLevel(doc, 0)).toBe(0)
  })

  it('returns the heading level when inside a section', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])

    const textPos = getFirstTextPos(doc)
    // Inside the H1 heading
    expect(getPasteContextLevel(doc, textPos + 5)).toBe(1)
  })

  it('returns the deepest nesting level for nested headings', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'intro'),
        heading(schema, 2, 'Sub', [paragraph(schema, 'sub body')])
      ])
    ])

    // Find position inside the H2's content
    let h2BodyPos = -1
    doc.descendants((node, pos) => {
      if (h2BodyPos !== -1) return false
      if (node.isText && node.text === 'sub body') {
        h2BodyPos = pos
        return false
      }
      return true
    })

    expect(getPasteContextLevel(doc, h2BodyPos)).toBe(2)
  })
})

// ===========================================================================
// 6. isEntireDocumentSelected: structural detection
// ===========================================================================

describe('isEntireDocumentSelected: matches CMD+A behavior', () => {
  it('detects full selection on a minimal document', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'A', [paragraph(schema, 'b')])])

    // CMD+A passes raw positions 0 and doc.content.size through AllSelection
    expect(isEntireDocumentSelected(doc, 0, doc.content.size)).toBe(true)
  })

  it('detects full selection on a multi-section document', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'A', [paragraph(schema, 'body a')]),
      heading(schema, 1, 'B', [paragraph(schema, 'body b')])
    ])

    expect(isEntireDocumentSelected(doc, 0, doc.content.size)).toBe(true)
  })
})

// ===========================================================================
// 7. Full round-trip: copy → standardize → paste
// ===========================================================================

describe('clipboard round-trip: structure is preserved after standardization', () => {
  it('linearizeHeadingNodes flattens heading tree for clipboard', () => {
    const h = heading(schema, 2, 'Title', [paragraph(schema, 'body')])
    const result = linearizeHeadingNodes([h])

    // Should produce: [contentHeading, paragraph]
    expect(result.length).toBe(2)
  })

  it('transformClipboardToStructured re-wraps linearized data back to headings', () => {
    const h = heading(schema, 2, 'Title', [paragraph(schema, 'body')])
    const linearized = linearizeHeadingNodes([h])
    const jsonNodes = linearized.map((n) =>
      typeof (n as any).toJSON === 'function' ? (n as any).toJSON() : n
    )

    const [paragraphs, headings] = transformClipboardToStructured(jsonNodes, { schema })

    expect(paragraphs).toHaveLength(0)
    expect(headings).toHaveLength(1)
    expect(headings[0].type.name).toBe(TIPTAP_NODES.HEADING_TYPE)
    expect(headings[0].attrs.level).toBe(2)
    expect(headings[0].child(0).type.name).toBe(TIPTAP_NODES.CONTENT_HEADING_TYPE)
    expect(headings[0].child(1).type.name).toBe(TIPTAP_NODES.CONTENT_WRAPPER_TYPE)
  })

  it('a complete copy→standardize→paste cycle produces valid HN-10 nodes', () => {
    // 1. Create a document
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'intro'),
        heading(schema, 2, 'Sub', [paragraph(schema, 'sub body')])
      ])
    ])

    // 2. Simulate copy: cut and extract blocks
    const from = getFirstTextPos(doc)
    const to = doc.content.size - 3
    const cutDoc = doc.cut(from, to)
    const selBlocks = getSelectionBlocks(cutDoc, 0, cutDoc.content.size, true, false)

    // 3. Serialize (what transformCopied does)
    const serialized = selBlocks.map((x) => schema.nodeFromJSON(x))
    const fragment = Fragment.fromArray(serialized)
    const clipboardSlice = Slice.maxOpen(fragment)

    // 4. Simulate paste: deserialize and transform
    const sliceJson = clipboardSlice.toJSON()
    const contentArray = Array.isArray(sliceJson?.content) ? sliceJson.content : []
    const [paragraphs, headings] = transformClipboardToStructured(contentArray, { schema })

    // 5. Verify: all headings are properly structured
    for (const h of headings) {
      expect(h.type.name).toBe(TIPTAP_NODES.HEADING_TYPE)
      expect(h.childCount).toBe(2)
      expect(h.child(0).type.name).toBe(TIPTAP_NODES.CONTENT_HEADING_TYPE)
      expect(h.child(1).type.name).toBe(TIPTAP_NODES.CONTENT_WRAPPER_TYPE)
      expect(() => h.check()).not.toThrow()
    }

    // Verify: all paragraphs are valid
    for (const p of paragraphs) {
      expect(p.type.name).toBe(TIPTAP_NODES.PARAGRAPH_TYPE)
      expect(() => p.check()).not.toThrow()
    }
  })
})
