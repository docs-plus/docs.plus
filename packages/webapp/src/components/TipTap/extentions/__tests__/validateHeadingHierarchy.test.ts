import { EditorState } from '@tiptap/pm/state'

import {
  getHierarchyViolations,
  hasHierarchyViolations,
  transactionMayAffectHierarchy,
  validateAndFixHeadingHierarchy
} from '../validateHeadingHierarchy'
import {
  buildDoc,
  createTestSchema,
  getFirstTextPos,
  getHeadingSnapshot,
  heading,
  paragraph
} from '../testUtils/testSchema'

describe('validateHeadingHierarchy', () => {
  const schema = createTestSchema()

  describe('transactionMayAffectHierarchy fast-path guard', () => {
    const makeValidDoc = () =>
      buildDoc(schema, [
        heading(schema, 1, 'Root', [heading(schema, 2, 'Child', [paragraph(schema, 'body text')])])
      ])

    it('returns false for plain text insertions', () => {
      const state = EditorState.create({ schema, doc: makeValidDoc() })
      const textPos = getFirstTextPos(state.doc)
      const tr = state.tr.insertText('x', textPos)

      expect(transactionMayAffectHierarchy(tr)).toBe(false)
    })

    it('returns false for small text deletions (backspace within text)', () => {
      const state = EditorState.create({ schema, doc: makeValidDoc() })
      const textPos = getFirstTextPos(state.doc)
      const tr = state.tr.delete(textPos, textPos + 1)

      expect(transactionMayAffectHierarchy(tr)).toBe(false)
    })

    it('returns true for large structural deletions', () => {
      const doc = buildDoc(schema, [
        heading(schema, 1, 'First', [paragraph(schema, 'a')]),
        heading(schema, 1, 'Second', [paragraph(schema, 'b')])
      ])
      const state = EditorState.create({ schema, doc })
      const secondPos = doc.content.size - doc.lastChild!.nodeSize
      const tr = state.tr.delete(secondPos, doc.content.size)

      expect(transactionMayAffectHierarchy(tr)).toBe(true)
    })

    it('returns true when inserted slice contains heading nodes', () => {
      const state = EditorState.create({ schema, doc: makeValidDoc() })
      const tr = state.tr.insert(
        state.doc.content.size,
        heading(schema, 1, 'Inserted Root', [paragraph(schema, 'tail')])
      )

      expect(transactionMayAffectHierarchy(tr)).toBe(true)
    })
  })

  it('extracts nested H1 to document root and clears violations', () => {
    const invalidDoc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'root body'),
        heading(schema, 2, 'Child H2', [
          paragraph(schema, 'child body'),
          heading(schema, 1, 'Nested Root', [paragraph(schema, 'nested root body')])
        ])
      ])
    ])

    const state = EditorState.create({ schema, doc: invalidDoc })
    expect(hasHierarchyViolations(state.doc)).toBe(true)

    const initialViolations = getHierarchyViolations(state.doc)
    expect(initialViolations.some((x) => x.type === 'h1-nested')).toBe(true)

    const tr = state.tr
    validateAndFixHeadingHierarchy(tr)

    expect(hasHierarchyViolations(tr.doc)).toBe(false)

    const headings = getHeadingSnapshot(tr.doc)
    const rootH1s = headings.filter((x) => x.level === 1 && x.depth === 1)
    expect(rootH1s).toHaveLength(2)
    expect(rootH1s.some((x) => x.title.includes('Nested Root'))).toBe(true)
    expect(headings.some((x) => x.level === 1 && x.depth > 1)).toBe(false)
  })

  it('extracts invalid child level to a valid sibling location', () => {
    const invalidDoc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        heading(schema, 3, 'Parent H3', [
          paragraph(schema, 'parent body'),
          heading(schema, 2, 'Invalid H2', [paragraph(schema, 'child body')])
        ])
      ])
    ])

    const state = EditorState.create({ schema, doc: invalidDoc })
    const initialViolations = getHierarchyViolations(state.doc)
    expect(initialViolations.some((x) => x.type === 'invalid-child-level')).toBe(true)

    const tr = state.tr
    validateAndFixHeadingHierarchy(tr)

    expect(hasHierarchyViolations(tr.doc)).toBe(false)

    const headings = getHeadingSnapshot(tr.doc)
    const parent = headings.find((x) => x.title.includes('Parent H3'))
    const extracted = headings.find((x) => x.title.includes('Invalid H2'))

    expect(parent).toBeDefined()
    expect(extracted).toBeDefined()
    expect(extracted!.level).toBe(2)
    expect(extracted!.depth).toBeLessThanOrEqual(parent!.depth)
  })

  it('is idempotent for already valid hierarchy', () => {
    const validDoc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        heading(schema, 2, 'Child H2', [
          heading(schema, 3, 'Child H3', [paragraph(schema, 'leaf')])
        ])
      ])
    ])

    const state = EditorState.create({ schema, doc: validDoc })
    expect(hasHierarchyViolations(state.doc)).toBe(false)

    const tr = state.tr
    const before = tr.doc.toJSON()

    validateAndFixHeadingHierarchy(tr)

    expect(tr.doc.toJSON()).toEqual(before)
    expect(hasHierarchyViolations(tr.doc)).toBe(false)
    expect(getHierarchyViolations(tr.doc)).toHaveLength(0)
  })

  it('keeps a complex forest with more than 6 H1 sections stable', () => {
    const complexForestDoc = buildDoc(schema, [
      heading(schema, 1, 'Section 1', [
        heading(schema, 2, 'S1-H2', [
          paragraph(schema, 'S1 body'),
          heading(schema, 4, 'S1-H4', [heading(schema, 6, 'S1-H6', [paragraph(schema, 'leaf')])])
        ])
      ]),
      heading(schema, 1, 'Section 2', [
        heading(schema, 3, 'S2-H3', [paragraph(schema, 'S2 body')])
      ]),
      heading(schema, 1, 'Section 3', [
        heading(schema, 2, 'S3-H2A', [paragraph(schema, 'A')]),
        heading(schema, 5, 'S3-H5B', [paragraph(schema, 'B')])
      ]),
      heading(schema, 1, 'Section 4', [
        heading(schema, 2, 'S4-H2', [
          heading(schema, 3, 'S4-H3', [heading(schema, 7, 'S4-H7', [paragraph(schema, 'deep')])])
        ])
      ]),
      heading(schema, 1, 'Section 5', [
        heading(schema, 4, 'S5-H4', [paragraph(schema, 'S5 body')])
      ]),
      heading(schema, 1, 'Section 6', [
        heading(schema, 2, 'S6-H2', [heading(schema, 8, 'S6-H8', [paragraph(schema, 'S6 deep')])])
      ]),
      heading(schema, 1, 'Section 7', [heading(schema, 9, 'S7-H9', [paragraph(schema, 'S7 body')])])
    ])

    const state = EditorState.create({ schema, doc: complexForestDoc })
    expect(hasHierarchyViolations(state.doc)).toBe(false)

    const tr = state.tr
    const before = tr.doc.toJSON()

    validateAndFixHeadingHierarchy(tr)

    expect(tr.doc.toJSON()).toEqual(before)
    expect(hasHierarchyViolations(tr.doc)).toBe(false)

    const headings = getHeadingSnapshot(tr.doc)
    const rootH1s = headings.filter((x) => x.level === 1 && x.depth === 1)
    expect(rootH1s).toHaveLength(7)
    expect(headings.some((x) => x.level === 1 && x.depth > 1)).toBe(false)
    expect(headings.some((x) => x.level === 9)).toBe(true)
  })
})
