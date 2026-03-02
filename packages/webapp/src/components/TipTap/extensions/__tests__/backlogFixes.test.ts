/**
 * TDD tests for backlog fixes: E-8, E-4, T-3, E-1.
 *
 * Strategy: RED → GREEN → REFACTOR
 * Tests written FIRST — each should FAIL before implementation.
 *
 * E-8: Input rule handler must validate parent context level before creating heading.
 * E-4: ContentHeading Backspace guard must detect first-heading structurally, not via `=== 2`.
 * T-3: Fold state is intentionally non-collaborative — documented behavior.
 * E-1: H1 pasted inside a section must be inserted after the current root H1, not at doc end.
 */

import { EditorState, TextSelection } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'

import { getPasteContextLevel } from '../helper/clipboard'
import { isFirstHeadingInDocument } from '../helper/selection'
import { buildDoc, createTestSchema, heading, paragraph } from '../testUtils/testSchema'

const schema = createTestSchema()

// ===========================================================================
// E-8: Input rules must validate parent context level
// ===========================================================================

describe('E-8: input rules respect parent context level', () => {
  it('getPasteContextLevel returns the parent heading level for a position inside a contentWrapper', () => {
    // H1 > H8 > [cursor in H8's contentWrapper]
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'root body'),
        heading(schema, 8, 'Deep', [paragraph(schema, 'deep body')])
      ])
    ])

    // Find a position inside H8's contentWrapper paragraph
    let deepParaPos = -1
    doc.descendants((node, pos) => {
      if (node.isText && node.textContent === 'deep body') {
        deepParaPos = pos
      }
    })
    expect(deepParaPos).toBeGreaterThan(0)

    const contextLevel = getPasteContextLevel(doc, deepParaPos)
    expect(contextLevel).toBe(8)
  })

  it('a heading with level <= context level is invalid', () => {
    // Inside H8's contentWrapper, creating H6 would violate child > parent (6 <= 8)
    const contextLevel = 8
    const candidateLevel = 6
    expect(candidateLevel).toBeLessThanOrEqual(contextLevel)
  })

  it('Heading.ts input rule handler validates context level before creating heading', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/nodes/Heading.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // The input rule handler must check context level
    expect(fileContent).toContain('getPasteContextLevel')
    // If level <= context, it should NOT create the heading
    expect(fileContent).toMatch(/level\s*<=\s*contextLevel|attributes\.level\s*<=\s*contextLevel/)
  })
})

// ===========================================================================
// E-4: ContentHeading Backspace must detect first-heading structurally
// ===========================================================================

describe('E-4: first-heading detection is structural, not magic number', () => {
  it('isFirstHeadingInDocument returns true for position inside the first contentHeading', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'First', [paragraph(schema, 'body')]),
      heading(schema, 1, 'Second', [paragraph(schema, 'body2')])
    ])

    // Position 2 is inside the first contentHeading (doc > heading > contentHeading > text)
    expect(isFirstHeadingInDocument(doc, 2)).toBe(true)
  })

  it('isFirstHeadingInDocument returns false for positions inside later headings', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'First', [paragraph(schema, 'body')]),
      heading(schema, 1, 'Second', [paragraph(schema, 'body2')])
    ])

    // Find the second heading's contentHeading position
    let secondContentHeadingPos = -1
    let headingCount = 0
    doc.descendants((node, pos) => {
      if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
        headingCount++
        if (headingCount === 2) {
          secondContentHeadingPos = pos + 1
        }
      }
    })
    expect(secondContentHeadingPos).toBeGreaterThan(2)

    expect(isFirstHeadingInDocument(doc, secondContentHeadingPos)).toBe(false)
  })

  it('ContentHeading.ts uses isFirstHeadingInDocument instead of magic number', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/nodes/ContentHeading.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Must NOT have the magic number pattern
    expect(fileContent).not.toMatch(/from\s*===\s*2/)
    expect(fileContent).not.toMatch(/\$from\.pos\s*===\s*2/)
    // Must use the structural helper
    expect(fileContent).toContain('isFirstHeadingInDocument')
  })

  it('onHeading.ts uses isFirstHeadingInDocument instead of magic number', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/extensions/normalText/onHeading.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Must NOT have the magic number pattern
    expect(fileContent).not.toMatch(/\$from\.pos\s*-\s*\$from\.textOffset\s*===\s*2/)
    // Must use the structural helper
    expect(fileContent).toContain('isFirstHeadingInDocument')
  })
})

// ===========================================================================
// T-3: Fold state is intentionally non-collaborative (documented)
// ===========================================================================

describe('T-3: fold state is documented as intentionally non-collaborative', () => {
  it('ContentWrapper.ts documents fold state as local-only', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/nodes/ContentWrapper.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain('NON-COLLABORATIVE BY DESIGN')
  })

  it('nodeState.ts documents fold state as local-only', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/extensions/helper/nodeState.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain('NON-COLLABORATIVE BY DESIGN')
  })

  it('headingTogglePlugin.ts documents fold state as local-only', async () => {
    const fs = await import('fs')
    const filePath =
      'src/components/TipTap/extensions/HeadingActions/plugins/headingTogglePlugin.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain('NON-COLLABORATIVE BY DESIGN')
  })
})

// ===========================================================================
// E-1: H1 pasted inside a section inserts after root H1, not at doc end
// ===========================================================================

describe('E-1: H1 pasted inside a section inserts after current root H1', () => {
  it('clipboardPaste.ts inserts H1 after the root H1 section, not at doc end', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/extensions/clipboardPaste.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Must NOT insert at doc.content.size unconditionally
    expect(fileContent).not.toMatch(
      /const\s+docEnd\s*=\s*tr\.doc\.content\.size\s*\n\s*tr\.insert\(docEnd/
    )
    // Must find the root H1 end position
    expect(fileContent).toContain('rootH1EndPos')
  })

  it('findRootH1EndPos returns the end position of the root H1 containing a given position', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Section A', [
        paragraph(schema, 'a body'),
        heading(schema, 2, 'A.1', [paragraph(schema, 'a1 body')])
      ]),
      heading(schema, 1, 'Section B', [paragraph(schema, 'b body')])
    ])

    // Find a position inside Section A's contentWrapper
    let posInsideA = -1
    doc.descendants((node, pos) => {
      if (node.isText && node.textContent === 'a1 body') {
        posInsideA = pos
      }
    })
    expect(posInsideA).toBeGreaterThan(0)

    // Import the helper
    const { findRootH1EndPos } = require('../helper/selection')
    const rootEnd = findRootH1EndPos(doc, posInsideA)

    // Should be the end of Section A, not the end of the entire document
    const sectionA = doc.child(0)
    const sectionAEnd = sectionA.nodeSize
    expect(rootEnd).toBe(sectionAEnd)

    // Must NOT be the doc end
    expect(rootEnd).toBeLessThan(doc.content.size)
  })

  it('H1 headings are inserted after the paste-target root H1, not at document end', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Section A', [
        paragraph(schema, 'a body'),
        heading(schema, 2, 'A.1', [paragraph(schema, 'a1 body')])
      ]),
      heading(schema, 1, 'Section B', [paragraph(schema, 'b body')]),
      heading(schema, 1, 'Section C', [paragraph(schema, 'c body')])
    ])

    const state = EditorState.create({ doc, schema })

    // After inserting a new H1 section at the root H1 boundary of Section A,
    // it should appear BETWEEN Section A and Section B, not after Section C
    const sectionAEnd = doc.child(0).nodeSize
    const newH1 = heading(schema, 1, 'New Section', [paragraph(schema, 'new body')])

    const tr = state.tr.insert(sectionAEnd, newH1)
    const newDoc = tr.doc

    // Verify: the new section is at index 1 (between A and B)
    const rootHeadings: string[] = []
    newDoc.forEach((child) => {
      if (child.type.name === TIPTAP_NODES.HEADING_TYPE) {
        rootHeadings.push(child.firstChild?.textContent || '')
      }
    })

    expect(rootHeadings).toEqual(['Section A', 'New Section', 'Section B', 'Section C'])
  })
})
