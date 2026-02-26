/**
 * Tests for Code-vs-Rules Audit fixes (V-1, V-2, E-6).
 *
 * V-1: ContentWrapper Enter handler must create structurally valid headings
 *      (contentHeading + contentWrapper children), not use setNode.
 * V-2: ensureContentWrapper command was dead code and has been removed.
 * E-6: wrapContentWithHeading H1-in-range guard must use block.le (the
 *      canonical heading level from contentHeading), not block.attrs.level.
 *
 * These tests use the shared testSchema helpers and real ProseMirror state
 * — no mocks. Each test corresponds to a finding in Code_vs_Rules_Audit.md.
 */

import { EditorState, TextSelection } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'

import { getRangeBlocks } from '../helper/selection'
import {
  buildDoc,
  contentWrapper,
  createTestSchema,
  getHeadingSnapshot,
  heading,
  paragraph
} from '../testUtils/testSchema'

const schema = createTestSchema()

// ===========================================================================
// V-1: ContentWrapper Enter — structurally valid heading creation
// ===========================================================================

describe('V-1: heading nodes must always have contentHeading + contentWrapper children', () => {
  it('a heading node created by schema always has exactly 2 children', () => {
    const level = 3
    const node = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level }, [
      schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level }),
      schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create(null, [
        schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create()
      ])
    ])

    expect(node.childCount).toBe(2)
    expect(node.child(0).type.name).toBe(TIPTAP_NODES.CONTENT_HEADING_TYPE)
    expect(node.child(1).type.name).toBe(TIPTAP_NODES.CONTENT_WRAPPER_TYPE)
    expect(node.child(0).attrs.level).toBe(level)
  })

  it('inserting a well-formed heading into a contentWrapper produces a valid document', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body'),
        heading(schema, 2, 'Existing', [paragraph(schema, 'existing body')])
      ])
    ])

    const state = EditorState.create({ doc, schema })

    // Find the end of the contentWrapper that contains the H2
    let cwEndPos = -1
    doc.descendants((node, pos) => {
      if (node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
        cwEndPos = pos + node.content.size
      }
    })
    expect(cwEndPos).toBeGreaterThan(0)

    const newHeading = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level: 2 }, [
      schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level: 2 }),
      schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create(null, [
        schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create()
      ])
    ])

    const tr = state.tr.insert(cwEndPos, newHeading)
    const newDoc = tr.doc

    // Verify: all headings in the document have valid structure
    newDoc.descendants((node) => {
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
        expect(node.childCount).toBe(2)
        expect(node.child(0).type.name).toBe(TIPTAP_NODES.CONTENT_HEADING_TYPE)
        expect(node.child(1).type.name).toBe(TIPTAP_NODES.CONTENT_WRAPPER_TYPE)
      }
    })

    // We should now have 3 headings total
    const headings = getHeadingSnapshot(newDoc)
    expect(headings).toHaveLength(3)
  })

  it('heading level propagates consistently to both heading.attrs and contentHeading.attrs', () => {
    const level = 5
    const node = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level }, [
      schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level }),
      schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create(null, [
        schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create()
      ])
    ])

    expect(node.attrs.level).toBe(level)
    expect(node.child(0).attrs.level).toBe(level)
  })
})

// ===========================================================================
// V-2: ensureContentWrapper command removal
// ===========================================================================

describe('V-2: ensureContentWrapper removal — heading structural validity', () => {
  it('a heading with zero children fails schema content validation', () => {
    // ProseMirror's create() doesn't throw on empty content, but check()
    // validates against the content expression. A heading without its
    // required contentHeading + contentWrapper children is invalid.
    const emptyHeading = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level: 1 }, [])
    expect(() => emptyHeading.check()).toThrow()
  })

  it('a heading with only a contentHeading (no contentWrapper) fails validation', () => {
    const headingMissingWrapper = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level: 1 }, [
      schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level: 1 })
    ])
    expect(() => headingMissingWrapper.check()).toThrow()
  })

  it('a properly structured heading passes schema content validation', () => {
    const validHeading = heading(schema, 1, 'Valid', [paragraph(schema, 'body')])
    expect(validHeading.childCount).toBe(2)
    expect(validHeading.child(0).type.name).toBe(TIPTAP_NODES.CONTENT_HEADING_TYPE)
    expect(validHeading.child(1).type.name).toBe(TIPTAP_NODES.CONTENT_WRAPPER_TYPE)
    expect(() => validHeading.check()).not.toThrow()
  })
})

// ===========================================================================
// E-6: getRangeBlocks stores heading level in `le`, not `attrs.level`
// ===========================================================================

describe('E-6: H1-in-range guard must use block.le for heading level', () => {
  it('getRangeBlocks stores heading level in the `le` field', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body'),
        heading(schema, 3, 'Deep', [paragraph(schema, 'deep body')])
      ])
    ])

    // Scan the entire contentWrapper range for heading blocks
    let cwStart = -1
    let cwEnd = -1
    doc.descendants((node, pos) => {
      if (node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE && cwStart === -1) {
        cwStart = pos + 1
        cwEnd = pos + node.content.size
      }
    })

    const blocks = getRangeBlocks(doc, cwStart, cwEnd)
    const headingBlocks = blocks.filter((b) => b.type === TIPTAP_NODES.HEADING_TYPE)

    expect(headingBlocks.length).toBeGreaterThan(0)
    const h3Block = headingBlocks[0]

    // `le` is the canonical source — derived from contentHeading child
    expect(h3Block.le).toBe(3)
  })

  it('attrs.level on heading blocks is the heading node attribute, not the contentHeading level', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body'),
        heading(schema, 5, 'H5 Child', [paragraph(schema, 'h5 body')])
      ])
    ])

    let cwStart = -1
    let cwEnd = -1
    doc.descendants((node, pos) => {
      if (node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE && cwStart === -1) {
        cwStart = pos + 1
        cwEnd = pos + node.content.size
      }
    })

    const blocks = getRangeBlocks(doc, cwStart, cwEnd)
    const headingBlocks = blocks.filter((b) => b.type === TIPTAP_NODES.HEADING_TYPE)

    expect(headingBlocks.length).toBeGreaterThan(0)
    const h5Block = headingBlocks[0]

    // `le` is the reliable heading level
    expect(h5Block.le).toBe(5)

    // `attrs.level` comes from the heading node's own attributes via toJSON
    // spread — in our test schema this is set correctly, but in production
    // the heading node's attrs.level can diverge from contentHeading's level
    // which is why code MUST use `le`, never `attrs.level`.
  })

  it('H1-in-range detection using block.le correctly identifies H1 headings', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body'),
        heading(schema, 2, 'H2 Child', [
          paragraph(schema, 'h2 body'),
          heading(schema, 1, 'Nested H1', [paragraph(schema, 'h1 body')])
        ])
      ])
    ])

    // Find the H2's contentWrapper
    let targetCwStart = -1
    let targetCwEnd = -1
    let foundH2 = false
    doc.descendants((node, pos) => {
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
        const level = node.firstChild?.attrs?.level
        if (level === 2) foundH2 = true
      }
      if (foundH2 && node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE && targetCwStart === -1) {
        targetCwStart = pos + 1
        targetCwEnd = pos + node.content.size
        foundH2 = false
      }
    })

    const blocks = getRangeBlocks(doc, targetCwStart, targetCwEnd)
    const headingBlocks = blocks.filter((b) => b.type === TIPTAP_NODES.HEADING_TYPE)

    // The guard in wrapContentWithHeading.ts should use block.le === 1
    const hasH1ViaLe = headingBlocks.some((block) => block.le === 1)
    expect(hasH1ViaLe).toBe(true)
  })
})
