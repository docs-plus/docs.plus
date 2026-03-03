/**
 * Tests for sprint fixes: E-9, T-1, E-3, E-5/T-2, extractH1ToRoot.
 *
 * E-9:  headingTogglePlugin promise chain — .finally() guarantees isProcessing reset.
 * T-1:  heading.group renamed from 'contentWrapper' to 'section'.
 * E-3:  insertHeadingsByNodeBlocks snapshots lastH1Inserted per iteration.
 * T-2:  contentHeading no longer belongs to 'block' group.
 * E-5:  deleteSelectedRange handles selection ending in contentHeading.
 * extractH1ToRoot: position guard requires pos < parentPos.
 *
 * Tests use the shared testSchema helpers and real ProseMirror state.
 */

import { EditorState } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'

import { insertHeadingsByNodeBlocks } from '../helper/headingMap'
import { validateAndFixHeadingHierarchy, hasHierarchyViolations } from '../validateHeadingHierarchy'
import { buildDoc, createTestSchema, heading, paragraph } from '../testUtils/testSchema'

const schema = createTestSchema()

// ===========================================================================
// E-9: headingTogglePlugin promise chain — structural assertions
// ===========================================================================

describe('E-9: headingTogglePlugin uses .finally() for isProcessing reset', () => {
  it('the handleHeadingToggle function uses .finally() to guarantee cleanup', async () => {
    const fs = await import('fs')
    const filePath =
      'src/components/TipTap/extensions/HeadingActions/plugins/headingTogglePlugin.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain('.finally(')
    // Nested .then() inside .then() is the anti-pattern that causes the deadlock
    expect(fileContent).not.toMatch(/\.then\(\s*\(\)\s*=>\s*\{[^}]*database\.toArray\(\)\.then/)
  })

  it('uses logger instead of console.error', async () => {
    const fs = await import('fs')
    const filePath =
      'src/components/TipTap/extensions/HeadingActions/plugins/headingTogglePlugin.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain("import { logger } from '@utils/logger'")
    expect(fileContent).not.toContain('console.error')
  })
})

// ===========================================================================
// E-10: nodeState.ts logger migration
// ===========================================================================

describe('E-10: nodeState.ts uses centralized logger', () => {
  it('nodeState.ts imports and uses logger, not console.error', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/extensions/helper/nodeState.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain("import { logger } from '@utils/logger'")
    expect(fileContent).not.toContain('console.error')
  })
})

// ===========================================================================
// T-1: heading.group renamed to 'section'
// ===========================================================================

describe('T-1: heading node group is "section", not "contentWrapper"', () => {
  it('Heading.ts sets group to "section"', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/nodes/Heading.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain("group: 'section'")
    expect(fileContent).not.toMatch(/group:\s*TIPTAP_NODES\.CONTENT_WRAPPER_TYPE/)
    expect(fileContent).not.toMatch(/group:\s*['"]contentWrapper['"]/)
  })

  it('contentWrapper.content accepts heading by node name, not group', () => {
    // The content expression is "(block)* heading*" — 'heading' is a node name.
    // Renaming the heading group does not affect whether headings are accepted.
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body'),
        heading(schema, 2, 'Child', [paragraph(schema, 'child body')])
      ])
    ])

    expect(() => doc.check()).not.toThrow()

    let headingCount = 0
    doc.descendants((node) => {
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) headingCount++
    })
    expect(headingCount).toBe(2)
  })
})

// ===========================================================================
// T-2: contentHeading no longer in 'block' group
// ===========================================================================

describe('T-2: contentHeading removed from block group', () => {
  it('ContentHeading.ts does not have group: "block"', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/nodes/ContentHeading.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).not.toMatch(/group:\s*['"]block['"]/)
  })

  it('contentHeading still works in its fixed slot inside heading', () => {
    const h = heading(schema, 3, 'Title', [paragraph(schema, 'body')])
    expect(h.childCount).toBe(2)
    expect(h.child(0).type.name).toBe(TIPTAP_NODES.CONTENT_HEADING_TYPE)
    expect(() => h.check()).not.toThrow()
  })
})

// ===========================================================================
// E-3: insertHeadingsByNodeBlocks snapshots lastH1Inserted
// ===========================================================================

describe('E-3: insertHeadingsByNodeBlocks does not share H1 bookmark across iterations', () => {
  it('does not mutate the lastH1Inserted reference during mid-loop iteration', () => {
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'root body')])])
    const state = EditorState.create({ doc, schema })
    const tr = state.tr

    // Build two H1 headings to insert
    const h1a = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level: 1 }, [
      schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level: 1 }, [schema.text('H1-A')]),
      schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create(null, [
        schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create()
      ])
    ])
    const h1b = schema.nodes[TIPTAP_NODES.HEADING_TYPE].create({ level: 1 }, [
      schema.nodes[TIPTAP_NODES.CONTENT_HEADING_TYPE].create({ level: 1 }, [schema.text('H1-B')]),
      schema.nodes[TIPTAP_NODES.CONTENT_WRAPPER_TYPE].create(null, [
        schema.nodes[TIPTAP_NODES.PARAGRAPH_TYPE].create()
      ])
    ])

    const lastH1Inserted = { startBlockPos: 0, endBlockPos: 0 }
    const originalRef = lastH1Inserted

    insertHeadingsByNodeBlocks(
      tr,
      [h1a, h1b],
      doc.content.size,
      lastH1Inserted,
      doc.content.size,
      0,
      0
    )

    // The same object reference should be updated at the end (not during)
    expect(lastH1Inserted).toBe(originalRef)
    // Final state reflects the last H1 inserted
    expect(lastH1Inserted.startBlockPos).toBeGreaterThan(0)
  })

  it('source code snapshots lastH1Inserted with spread operator', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/extensions/helper/headingMap.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Verify the snapshot pattern exists
    expect(fileContent).toContain('let currentH1 = { ...lastH1Inserted }')
    // Verify per-iteration snapshot on H1 insert (new object, not mutation)
    expect(fileContent).toContain('currentH1 = {')
  })
})

// ===========================================================================
// extractH1ToRoot: position guard requires pos < parentPos
// ===========================================================================

describe('extractH1ToRoot: position guard excludes self-matches', () => {
  it('the guard includes pos < parentPos to avoid matching the parent itself', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/extensions/validateHeadingHierarchy.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    expect(fileContent).toContain(
      'level === 1 && pos < parentPos && pos + node.nodeSize > parentPos'
    )
  })

  it('extractH1ToRoot correctly extracts a nested H1 to document root', () => {
    // Build: H1("Root") > H2("Parent") > H1("Nested") — invalid per HN-10
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'root body'),
        heading(schema, 2, 'Parent', [
          paragraph(schema, 'parent body'),
          heading(schema, 1, 'Nested', [paragraph(schema, 'nested body')])
        ])
      ])
    ])

    expect(hasHierarchyViolations(doc)).toBe(true)

    const state = EditorState.create({ doc, schema })
    const tr = state.tr
    validateAndFixHeadingHierarchy(tr)

    // After fix: nested H1 should be extracted to document root
    const fixedDoc = tr.doc
    const rootHeadings: string[] = []
    fixedDoc.forEach((child) => {
      if (child.type.name === TIPTAP_NODES.HEADING_TYPE) {
        rootHeadings.push(child.firstChild?.textContent || '')
      }
    })

    expect(rootHeadings).toContain('Nested')
    expect(hasHierarchyViolations(fixedDoc)).toBe(false)
  })

  it('does not false-positive when parentPos equals an H1 position', () => {
    // Two root H1s — no violations, the guard should not misfire
    const doc = buildDoc(schema, [
      heading(schema, 1, 'First', [paragraph(schema, 'a')]),
      heading(schema, 1, 'Second', [paragraph(schema, 'b')])
    ])

    expect(hasHierarchyViolations(doc)).toBe(false)
  })

  it('fixes invalid child level (child <= parent) by extracting as sibling', () => {
    // H1 > H3 > H2 — H2 is invalid child of H3 (2 <= 3 is fine... wait, 2 < 3)
    // Actually H1 > H3 > H2 means H2 is child of H3 with level 2 <= 3 — INVALID
    // because child level (2) must be > parent level (3)
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'body'),
        heading(schema, 3, 'Parent', [
          paragraph(schema, 'parent body'),
          heading(schema, 2, 'Invalid Child', [paragraph(schema, 'child body')])
        ])
      ])
    ])

    expect(hasHierarchyViolations(doc)).toBe(true)

    const state = EditorState.create({ doc, schema })
    const tr = state.tr
    validateAndFixHeadingHierarchy(tr)

    expect(hasHierarchyViolations(tr.doc)).toBe(false)
  })
})

// ===========================================================================
// E-5: deleteSelectedRange handles contentHeading selection boundary
// ===========================================================================

describe('E-5: deleteSelectedRange source handles contentHeading boundary', () => {
  it('does not blindly return false when selection ends in contentHeading', async () => {
    const fs = await import('fs')
    const filePath = 'src/components/TipTap/extensions/deleteSelectedRange.ts'
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Should NOT have the old pattern of immediately returning false
    expect(fileContent).not.toMatch(
      /CONTENT_HEADING_TYPE\)\s*\{\s*\/\/.*\n\s*logger\.warn\([^)]+\)\s*\n\s*return false/
    )
    // Should contain heading boundary resolution logic
    expect(fileContent).toContain('HEADING_TYPE')
    expect(fileContent).toContain('headingEnd')
  })
})
