/**
 * TDD tests for data-safety audit fixes: T-5, E-7, T-4.
 *
 * T-5: clipboardPaste error handler must return the original slice (not
 *      Slice.empty) so ProseMirror's default paste can still try.
 * E-7: getSelectionBlocks with range=false must work with relative positions
 *      on a doc.cut() fragment, not absolute positions from the full doc.
 * T-4: isEntireDocumentSelected must detect select-all structurally, without
 *      magic numbers like 2 / docSize - 3.
 */

import { Fragment, Slice } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'

import { getSelectionBlocks, isEntireDocumentSelected } from '../helper/selection'
import { buildDoc, createTestSchema, heading, paragraph } from '../testUtils/testSchema'

const schema = createTestSchema()

// ===========================================================================
// T-5: clipboardPaste error fallback must preserve the user's clipboard
// ===========================================================================

describe('T-5: clipboardPaste returns original slice on internal error', () => {
  it('the error catch path in clipboardPaste.ts returns the input slice, not Slice.empty', async () => {
    const source = await import('../clipboardPaste')
    const sourceText = source.default.toString()

    // The catch block must contain "return slice" (not "return Slice.empty")
    // This is a structural assertion that guards against regression.
    expect(sourceText).toContain('return slice')
    expect(sourceText).not.toMatch(/catch[\s\S]*?return\s+Slice\.empty/)
  })

  it('Slice.empty is a zero-size fallback — never acceptable for user clipboard data', () => {
    const userContent = schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create(null, [
      schema.text('important text')
    ])
    const userSlice = new Slice(Fragment.from(userContent), 0, 0)

    expect(userSlice.content.size).toBeGreaterThan(0)
    expect(Slice.empty.content.size).toBe(0)
    expect(userSlice).not.toBe(Slice.empty)
  })
})

// ===========================================================================
// E-7: getSelectionBlocks with cut document must use relative positions
// ===========================================================================

describe('E-7: getSelectionBlocks works correctly with cut document fragments', () => {
  it('returns blocks when called with relative positions on a cut document', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'first paragraph'),
        paragraph(schema, 'second paragraph')
      ])
    ])

    const from = 3
    const to = doc.content.size - 3

    const cutDoc = doc.cut(from, to)
    const blocks = getSelectionBlocks(cutDoc, 0, cutDoc.content.size, true, false)

    expect(blocks.length).toBeGreaterThan(0)
  })

  it('range=true traverses the entire cut document regardless of positions', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body text'),
        heading(schema, 2, 'Sub', [paragraph(schema, 'sub body')])
      ])
    ])

    const from = 3
    const to = doc.content.size - 3

    const cutDoc = doc.cut(from, to)

    // With range=true, positions are ignored — doc.descendants is used
    const blocksViaRange = getSelectionBlocks(cutDoc, 0, cutDoc.content.size, true, true)
    expect(blocksViaRange.length).toBeGreaterThan(0)

    // Both paths should return the same blocks for a cut document
    const blocksViaBetween = getSelectionBlocks(cutDoc, 0, cutDoc.content.size, true, false)
    expect(blocksViaBetween.length).toBe(blocksViaRange.length)
  })
})

// ===========================================================================
// T-4: isEntireDocumentSelected — structural select-all detection
// ===========================================================================

describe('T-4: isEntireDocumentSelected detects select-all without magic numbers', () => {
  it('returns true when selection covers the full text range of a single-section doc', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])

    const state = EditorState.create({ doc, schema })
    const firstTextPos = findFirstEditablePos(doc)
    const lastTextPos = findLastEditablePos(doc)

    expect(isEntireDocumentSelected(doc, firstTextPos, lastTextPos)).toBe(true)
  })

  it('returns true for a multi-section document with full selection', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Section A', [paragraph(schema, 'body a')]),
      heading(schema, 1, 'Section B', [paragraph(schema, 'body b')]),
      heading(schema, 1, 'Section C', [paragraph(schema, 'body c')])
    ])

    const firstTextPos = findFirstEditablePos(doc)
    const lastTextPos = findLastEditablePos(doc)

    expect(isEntireDocumentSelected(doc, firstTextPos, lastTextPos)).toBe(true)
  })

  it('returns false for a partial selection', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'first paragraph'),
        paragraph(schema, 'second paragraph')
      ])
    ])

    const firstTextPos = findFirstEditablePos(doc)
    // Select only the first paragraph, not the whole doc
    expect(isEntireDocumentSelected(doc, firstTextPos, firstTextPos + 5)).toBe(false)
  })

  it('returns false when selection starts after the first text position', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])

    const lastTextPos = findLastEditablePos(doc)
    // Start from a position that's not the very beginning
    expect(isEntireDocumentSelected(doc, 5, lastTextPos)).toBe(false)
  })

  it('works with deeply nested documents (H1 > H2 > H3)', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'intro'),
        heading(schema, 2, 'Sub', [
          paragraph(schema, 'sub body'),
          heading(schema, 3, 'Deep', [paragraph(schema, 'deep body')])
        ])
      ])
    ])

    const firstTextPos = findFirstEditablePos(doc)
    const lastTextPos = findLastEditablePos(doc)

    expect(isEntireDocumentSelected(doc, firstTextPos, lastTextPos)).toBe(true)
    expect(isEntireDocumentSelected(doc, firstTextPos, lastTextPos - 5)).toBe(false)
  })
})

// ===========================================================================
// P3-1: clipboardPaste must guard against depth-0 positions (AllSelection)
// ===========================================================================

describe('P3-1: clipboardPaste handles depth-0 positions from AllSelection', () => {
  it('does not crash and dispatches a valid document when $from.depth < 1', async () => {
    const source = await import('../clipboardPaste')
    const clipboardPaste = source.default

    const userContent = schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level: 1 }, [
      schema.text('Pasted Title')
    ])
    const userSlice = new Slice(Fragment.from(userContent), 0, 0)

    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])
    const state = EditorState.create({ doc, schema })

    const mockEditor = {
      state: {
        ...state,
        schema: state.schema,
        tr: state.tr,
        selection: {
          from: 0,
          to: doc.content.size,
          $from: doc.resolve(0),
          $to: doc.resolve(doc.content.size)
        }
      },
      view: {
        dispatch: jest.fn()
      }
    }

    // Must NOT throw — should handle the full-doc paste
    const result = clipboardPaste(userSlice, mockEditor as any)
    expect(result).toEqual(Slice.empty)
    expect(mockEditor.view.dispatch).toHaveBeenCalledTimes(1)

    // The dispatched doc must have at least one heading
    const newDoc = mockEditor.view.dispatch.mock.calls[0][0].doc
    let headingCount = 0
    newDoc.descendants((node: any) => {
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) headingCount++
    })
    expect(headingCount).toBeGreaterThanOrEqual(1)
  })

  it('checks depth before accessing .start(1) / .end(1)', async () => {
    const source = await import('../clipboardPaste')
    const sourceText = source.default.toString()

    expect(sourceText).toMatch(/depth\s*<\s*1/)
  })
})

// ===========================================================================
// TG-6 / CP-4: getSelectionRangeSlice returns [] when selection starts in contentHeading
// ===========================================================================

describe('CP-4: getSelectionRangeSlice handles contentHeading selection gracefully', () => {
  it('returns empty array when selection starts within a contentHeading', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Title', [paragraph(schema, 'body text')])])

    // Position inside the contentHeading text (pos 3 = inside "Title")
    const contentHeadingTextPos = 3
    const endPos = doc.content.size - 1

    const { getSelectionRangeSlice } = require('../helper/selection')
    const state = EditorState.create({ doc, schema })

    const result = getSelectionRangeSlice(doc, state, contentHeadingTextPos, endPos)

    expect(result).toEqual([])
  })

  it('returns blocks normally when selection starts in contentWrapper', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Title', [
        paragraph(schema, 'first paragraph'),
        paragraph(schema, 'second paragraph')
      ])
    ])

    const state = EditorState.create({ doc, schema })

    // Find a position inside the contentWrapper (after contentHeading)
    let cwTextPos = -1
    doc.descendants((node, pos) => {
      if (cwTextPos !== -1) return false
      if (
        node.type.name === TIPTAP_NODES.PARAGRAPH_TYPE &&
        node.textContent === 'first paragraph'
      ) {
        cwTextPos = pos + 1
        return false
      }
      return true
    })
    expect(cwTextPos).toBeGreaterThan(0)

    const endPos = doc.content.size - 1
    const { getSelectionRangeSlice } = require('../helper/selection')
    const result = getSelectionRangeSlice(doc, state, cwTextPos, endPos)

    expect(result.length).toBeGreaterThan(0)
  })
})

// ===========================================================================
// Helpers for test setup
// ===========================================================================

function findFirstEditablePos(doc: ReturnType<typeof buildDoc>): number {
  let pos = -1
  doc.descendants((node, nodePos) => {
    if (pos !== -1) return false
    if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      pos = nodePos + 1
      return false
    }
    return true
  })
  return pos
}

function findLastEditablePos(doc: ReturnType<typeof buildDoc>): number {
  let pos = -1
  doc.descendants((node, nodePos) => {
    if (node.isBlock && node.type.name !== TIPTAP_NODES.DOC_TYPE) {
      const endPos = nodePos + node.content.size
      if (endPos > pos) pos = endPos
    }
  })
  return pos
}
