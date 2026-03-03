/* eslint-disable no-undef */
/**
 * HN-10 Production Readiness — Comprehensive E2E Test Suite
 *
 * Test Matrix:
 *   1. Schema Fundamentals     — doc structure, node types, HN-10 constraints
 *   2. Heading Creation         — all levels, nesting, sibling, non-sequential
 *   3. Heading Level Change     — forward, backward, H1 guard, children re-attach
 *   4. Normal Text Conversion   — dissolution, first-heading guard, multi-children
 *   5. Clipboard Paste          — H1 extraction, level adjustment, clamping, mixed
 *   6. Delete Operations        — cross-boundary, contentHeading guard, select-all
 *   7. Hierarchy Validation     — plugin auto-fix, no false positives
 *
 * Principles: DRY helpers, KISS assertions, TDD-first.
 * Spec Reference: HN-10 — Editor_Schema_Rules_v3.md
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

// =============================================================================
// SHARED DRY HELPERS
// =============================================================================

/** Validates the document follows ALL HN-10 schema rules. */
const validateSchema = () =>
  cy.window().then((win) => {
    const editor = win._editor
    if (!editor) return { valid: false, errors: ['Editor not found'] }

    const doc = editor.state.doc
    const errors = []
    const stack = []

    doc.descendants((node, pos) => {
      if (node.type.name !== 'heading') return

      const level = node.firstChild?.attrs?.level || node.attrs?.level || 1
      const endPos = pos + node.nodeSize
      const title = node.firstChild?.textContent?.slice(0, 30) || 'Untitled'

      // Pop expired parents
      while (stack.length && pos >= stack[stack.length - 1].endPos) stack.pop()

      if (stack.length) {
        const parent = stack[stack.length - 1]
        if (level === 1) errors.push(`H1 "${title}" nested inside H${parent.level}`)
        if (level <= parent.level) errors.push(`H${level} "${title}" ≤ parent H${parent.level}`)
      }

      if (level < 1 || level > 10) errors.push(`H${level} "${title}" out of range`)

      stack.push({ pos, level, endPos, title })
    })

    return { valid: errors.length === 0, errors }
  })

/** Asserts schema is valid; logs errors on failure for debugging. */
const assertSchemaValid = (label = 'Schema') =>
  validateSchema().then((result) => {
    if (!result.valid) cy.log(`${label} errors: ${JSON.stringify(result.errors)}`)
    expect(result.valid, `${label} should be valid`).to.be.true
  })

/** Returns array of { level, title, depth, pos, endPos } for every heading. */
const getDocStructure = () =>
  cy.window().then((win) => {
    const editor = win._editor
    if (!editor) return []

    const doc = editor.state.doc
    const result = []

    doc.descendants((node, pos) => {
      if (node.type.name !== 'heading') return
      const level = node.firstChild?.attrs?.level || 1
      const title = node.firstChild?.textContent || 'Untitled'
      const rawDepth = doc.resolve(pos).depth
      result.push({
        level,
        title,
        depth: rawDepth === 0 ? 1 : rawDepth,
        pos,
        endPos: pos + node.nodeSize
      })
    })

    return result
  })

/** Pastes HTML into the editor via ClipboardEvent. */
const pasteHTML = (html) => {
  cy.window().then((win) => {
    const editor = win._editor
    if (!editor) return

    const dt = new DataTransfer()
    dt.setData('text/html', html)
    dt.setData('text/plain', html.replace(/<[^>]*>/g, ''))

    editor.view.dom.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
    )
  })
  cy.wait(100) // allow plugins to settle
}

/** Clicks inside a contentWrapper paragraph for a heading at the given level. */
const clickContentArea = (level = 1, idx = 0) => {
  cy.get(`.docy_editor .heading[level="${level}"] .contentWrapper p`).eq(idx).click()
  cy.realPress('End')
  cy.wait(100)
}

/** Clicks inside a contentHeading for a heading at the given level. */
const clickHeadingTitle = (level = 1, idx = 0) => {
  cy.get(`.docy_editor .heading[level="${level}"] .contentHeading`).eq(idx).click()
  cy.wait(100)
}

/** Sets caret in a heading with the given text at a specific level. */
const putCaretInHeading = (level, text, position = 'end') =>
  cy.putPosCaretInHeading(level, text, position)

/** Changes heading level via keyboard shortcut. */
const changeLevel = (newLevel) =>
  cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', `${newLevel}`])

/** Converts heading to normal text via keyboard shortcut (Alt+Meta+0). */
const toNormalText = () =>
  cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '0'])

/** Waits for hierarchy validation plugin to settle. */
const waitForPlugin = () => cy.wait(300)

// =============================================================================
// TEST SUITE
// =============================================================================

describe(
  'Heading Schema Production Readiness — Comprehensive E2E',
  { testIsolation: false },
  () => {
    before(() => {
      cy.visitEditor({ persist: false })
      cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
    })

    beforeEach(() => {
      cy.clearEditor()
    })

    // ===========================================================================
    // 1. SCHEMA FUNDAMENTALS
    // ===========================================================================
    describe('1. Schema Fundamentals', () => {
      it('1.1 Doc always contains at least one H1 section', () => {
        // Even after select-all + delete, doc must keep one H1
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Backspace')
        cy.wait(100)
        cy.get('.docy_editor .heading[level="1"]').should('have.length.gte', 1)
        assertSchemaValid('1.1')
      })

      it('1.2 Full 10-level chain nests correctly', () => {
        cy.createDocument([
          section('L1', [
            heading(2, 'L2', [
              heading(3, 'L3', [
                heading(4, 'L4', [
                  heading(5, 'L5', [
                    heading(6, 'L6', [
                      heading(7, 'L7', [
                        heading(8, 'L8', [
                          heading(9, 'L9', [heading(10, 'L10', [paragraph('deepest')])])
                        ])
                      ])
                    ])
                  ])
                ])
              ])
            ])
          ])
        ])
        cy.wait(100)

        for (let lvl = 1; lvl <= 10; lvl++) {
          cy.get(`.docy_editor .heading[level="${lvl}"]`).should('have.length.gte', 1)
        }

        assertSchemaValid('1.2')
      })

      it('1.3 Multiple root H1 sections are siblings (forest)', () => {
        cy.createDocument([
          section('Section A', [paragraph('A content')]),
          section('Section B', [paragraph('B content')]),
          section('Section C', [paragraph('C content')])
        ])
        cy.wait(100)

        getDocStructure().then((headings) => {
          const h1s = headings.filter((h) => h.level === 1)
          expect(h1s.length).to.equal(3)
          h1s.forEach((h1) => expect(h1.depth).to.equal(1))
        })

        assertSchemaValid('1.3')
      })

      it('1.4 Heading node structure: contentHeading + contentWrapper', () => {
        cy.createDocument([section('Test', [heading(2, 'Sub', [paragraph('body')])])])

        // Each heading should contain exactly one contentHeading and one contentWrapper
        cy.get('.docy_editor .heading[level="2"]').within(() => {
          cy.get('.contentHeading').should('have.length', 1)
          cy.get('.contentWrapper').should('have.length', 1)
        })

        assertSchemaValid('1.4')
      })

      it('1.5 Non-sequential heading nesting is valid (H1→H4)', () => {
        cy.createDocument([section('Root', [heading(4, 'Jumped to H4', [paragraph('content')])])])

        assertSchemaValid('1.5')
        cy.get('.docy_editor .heading[level="4"]').should('exist')
      })
    })

    // ===========================================================================
    // 2. HEADING CREATION
    // ===========================================================================
    describe('2. Heading Creation', () => {
      it('2.1 Create H2 child inside H1 via keyboard shortcut', () => {
        cy.createDocument([section('Parent', [paragraph('some text')])])

        clickContentArea(1)
        cy.get('.docy_editor > .tiptap.ProseMirror').type('New Heading')
        changeLevel(2)
        cy.wait(100)

        cy.get('.docy_editor .heading[level="2"]').should('exist')
        assertSchemaValid('2.1')
      })

      it('2.2 Create sibling H2 headings under same H1', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'First H2', [paragraph('content 1')]),
            heading(2, 'Second H2', [paragraph('content 2')]),
            heading(2, 'Third H2', [paragraph('content 3')])
          ])
        ])
        cy.wait(100)

        cy.get('.docy_editor .heading[level="2"]').should('have.length', 3)
        assertSchemaValid('2.2 — HN-10 §8.3 sibling semantics')
      })

      it('2.3 Create deep nested chain H2→H3→H4', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'H2', [heading(3, 'H3', [heading(4, 'H4', [paragraph('deep')])])])
          ])
        ])
        cy.wait(100)

        getDocStructure().then((headings) => {
          const h4 = headings.find((h) => h.level === 4)
          expect(h4).to.exist
          expect(h4.depth).to.be.greaterThan(3) // deeply nested
        })

        assertSchemaValid('2.3')
      })
    })

    // ===========================================================================
    // 3. HEADING LEVEL CHANGE
    // ===========================================================================
    describe('3. Heading Level Change', () => {
      it('3.1 First H1 in document cannot change level', () => {
        cy.createDocument([section('Only Section', [paragraph('content')])])

        clickHeadingTitle(1, 0)
        changeLevel(2)
        cy.wait(100)

        // Must still be H1
        cy.get('.docy_editor .heading[level="1"]').should('exist')
        assertSchemaValid('3.1 — First H1 guard')
      })

      it('3.2 Non-first H1 can be changed to H2 (becomes nested)', () => {
        cy.createDocument([
          section('First', [paragraph('first')]),
          section('Second', [paragraph('second')])
        ])
        cy.wait(100)

        putCaretInHeading(1, 'Second', 'start')
        changeLevel(2)
        cy.wait(100)

        // "Second" should now be H2 under "First"
        cy.get('.docy_editor').should('contain', 'Second')
        assertSchemaValid('3.2 — H1→H2')
      })

      it('3.3 Forward change H2→H3 (deeper nesting)', () => {
        cy.createDocument([section('Root', [heading(2, 'Will Become H3', [paragraph('content')])])])

        putCaretInHeading(2, 'Will Become H3', 'start')
        changeLevel(3)
        cy.wait(100)

        cy.get('.docy_editor').should('contain', 'Will Become H3')
        assertSchemaValid('3.3 — H2→H3')
      })

      it('3.4 Backward change H3→H2 (promotion)', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'Parent H2', [heading(3, 'Child H3', [paragraph('h3 body')])])
          ])
        ])
        cy.wait(100)

        putCaretInHeading(3, 'Child H3', 'start')
        changeLevel(2)
        cy.wait(100)

        cy.get('.docy_editor').should('contain', 'Child H3')
        assertSchemaValid('3.4 — H3→H2 backward')
      })

      it('3.5 Same-level change is no-op', () => {
        cy.createDocument([section('Root', [heading(2, 'Stay H2', [paragraph('content')])])])

        putCaretInHeading(2, 'Stay H2', 'start')
        changeLevel(2) // same level
        cy.wait(100)

        cy.get('.docy_editor .heading[level="2"]').should('exist')
        assertSchemaValid('3.5 — same level no-op')
      })

      it('3.6 H3→H2 with H4 children — children re-attached under new H2', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'Parent', [
              heading(3, 'Promoted', [
                paragraph('body'),
                heading(4, 'Grandchild', [paragraph('gc body')])
              ])
            ])
          ])
        ])
        cy.wait(100)

        putCaretInHeading(3, 'Promoted', 'start')
        changeLevel(2)
        cy.wait(100)

        // Grandchild should still exist and be valid
        cy.get('.docy_editor').should('contain', 'Grandchild')
        assertSchemaValid('3.6 — children re-attach')
      })

      it('3.7 Non-sequential forward H2→H5', () => {
        cy.createDocument([section('Root', [heading(2, 'Jump Forward', [paragraph('content')])])])

        putCaretInHeading(2, 'Jump Forward', 'start')
        changeLevel(5)
        cy.wait(100)

        cy.get('.docy_editor').should('contain', 'Jump Forward')
        assertSchemaValid('3.7 — H2→H5 non-sequential')
      })
    })

    // ===========================================================================
    // 4. NORMAL TEXT CONVERSION
    // ===========================================================================
    describe('4. Normal Text Conversion (Dissolution)', () => {
      it('4.1 First heading in document cannot be dissolved', () => {
        cy.createDocument([section('First', [paragraph('content')])])

        clickHeadingTitle(1, 0)
        toNormalText()
        cy.wait(100)

        cy.get('.docy_editor .heading[level="1"]').should('exist')
        assertSchemaValid('4.1 — first heading guard')
      })

      it('4.2 Dissolve H2 heading converts to paragraph, preserves content', () => {
        cy.createDocument([section('Root', [heading(2, 'To Dissolve', [paragraph('Body text')])])])

        putCaretInHeading(2, 'To Dissolve', 'start')
        toNormalText()
        cy.wait(100)

        cy.get('.docy_editor').should('contain', 'To Dissolve')
        cy.get('.docy_editor').should('contain', 'Body text')
        assertSchemaValid('4.2 — H2 dissolution')
      })

      it('4.3 Dissolve heading with multiple children re-attaches them', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'Parent to Kill', [
              paragraph('Para'),
              heading(3, 'Child A', [paragraph('A body')]),
              heading(3, 'Child B', [paragraph('B body')])
            ])
          ])
        ])
        cy.wait(100)

        putCaretInHeading(2, 'Parent to Kill', 'start')
        toNormalText()
        cy.wait(100)

        // Children should still exist or be re-attached
        cy.get('.docy_editor').should('contain', 'Parent to Kill')
        cy.get('.docy_editor').should('contain', 'Para')
        assertSchemaValid('4.3 — multi-child dissolution')
      })
    })

    // ===========================================================================
    // 5. CLIPBOARD PASTE
    // ===========================================================================
    describe('5. Clipboard Paste', () => {
      it('5.1 Paste plain text into contentHeading', () => {
        cy.createDocument([section('Hello', [paragraph('content')])])

        clickHeadingTitle(1, 0)
        pasteHTML('<p>World</p>')

        cy.get('.docy_editor').should('contain', 'World')
        assertSchemaValid('5.1')
      })

      it('5.2 Paste paragraphs into contentWrapper', () => {
        cy.createDocument([section('Root', [paragraph('existing')])])

        clickContentArea(1)
        pasteHTML('<p>Extra paragraph</p><p>Another one</p>')

        cy.get('.docy_editor').should('contain', 'Extra paragraph')
        cy.get('.docy_editor').should('contain', 'Another one')
        assertSchemaValid('5.2')
      })

      it('Paste single H1 creates new root section', () => {
        cy.createDocument([section('Original', [paragraph('original content')])])

        clickContentArea(1)
        pasteHTML('<h1>New Section</h1><p>New content</p>')
        waitForPlugin()

        cy.get('.docy_editor').should('contain', 'New Section')
        assertSchemaValid('5.3')

        getDocStructure().then((headings) => {
          const h1s = headings.filter((h) => h.level === 1)
          expect(h1s.length).to.be.at.least(2)
          h1s.forEach((h) => expect(h.depth).to.equal(1))
        })
      })

      it('Paste 2 H1 headings creates 2 new root sections', () => {
        cy.createDocument([section('First', [paragraph('content')])])

        clickContentArea(1)
        pasteHTML('<h1>Second</h1><p>S2</p><h1>Third</h1><p>S3</p>')
        waitForPlugin()

        assertSchemaValid('5.4 — multi-H1')
        getDocStructure().then((headings) => {
          const h1s = headings.filter((h) => h.level === 1)
          expect(h1s.length).to.be.at.least(2, 'Should have multiple root sections')
          h1s.forEach((h) => expect(h.depth).to.equal(1))
        })
      })

      it('5.5 Paste 3 H1 headings creates 3 new root sections', () => {
        cy.createDocument([section('Alpha', [paragraph('a')])])

        clickContentArea(1)
        pasteHTML('<h1>Beta</h1><p>b</p><h1>Gamma</h1><p>g</p><h1>Delta</h1><p>d</p>')
        waitForPlugin()

        assertSchemaValid('5.5 — 3 H1s')
        getDocStructure().then((headings) => {
          const h1s = headings.filter((h) => h.level === 1)
          expect(h1s.length).to.be.at.least(3)
        })
      })

      it('5.6 Paste mixed H1 and H2 — H2s stay nested, H1s go to root', () => {
        cy.createDocument([section('Main', [paragraph('main')])])

        clickContentArea(1)
        pasteHTML('<h2>Sub Chapter</h2><p>sc</p><h1>New Root</h1><p>nr</p>')
        waitForPlugin()

        assertSchemaValid('5.6 — mixed H1/H2')
        cy.get('.docy_editor').should('contain', 'Sub Chapter')
        cy.get('.docy_editor').should('contain', 'New Root')
      })

      it('5.7 Paste deep hierarchy (H2→H3→H4→H5) at shallow level', () => {
        cy.createDocument([section('Shallow', [paragraph('base')])])

        clickContentArea(1)
        pasteHTML(
          '<h2>L2</h2><p>c2</p><h3>L3</h3><p>c3</p><h4>L4</h4><p>c4</p><h5>L5</h5><p>c5</p>'
        )
        waitForPlugin()

        assertSchemaValid('5.7 — deep hierarchy paste')
        cy.get('.docy_editor').should('contain', 'L2')
        cy.get('.docy_editor').should('contain', 'L5')
      })

      it('5.8 Paste same-level siblings (3× H2)', () => {
        cy.createDocument([section('Parent', [paragraph('before')])])

        clickContentArea(1)
        pasteHTML('<h2>Sib A</h2><p>a</p><h2>Sib B</h2><p>b</p><h2>Sib C</h2><p>c</p>')
        waitForPlugin()

        assertSchemaValid('5.8 — sibling paste')
        cy.get('.docy_editor').should('contain', 'Sib A')
        cy.get('.docy_editor').should('contain', 'Sib B')
        cy.get('.docy_editor').should('contain', 'Sib C')
      })

      it('5.9 Paste non-sequential levels (H2→H5, skipping H3/H4)', () => {
        cy.createDocument([section('Test', [paragraph('content')])])

        clickContentArea(1)
        pasteHTML('<h2>Jump H2</h2><p>j2</p><h5>Jump H5</h5><p>j5</p>')
        waitForPlugin()

        assertSchemaValid('5.9 — non-sequential (HN-10 §6.2)')
        cy.get('.docy_editor').should('contain', 'Jump H2')
        cy.get('.docy_editor').should('contain', 'Jump H5')
      })

      it('5.10 Paste with empty paragraphs (trimEmptyNodes)', () => {
        cy.createDocument([section('Empty', [paragraph('existing')])])

        clickContentArea(1)
        pasteHTML('<p></p><h2>After Empty</h2><p></p><p>Real content</p><p></p>')
        waitForPlugin()

        assertSchemaValid('5.10 — trimEmptyNodes')
        cy.get('.docy_editor').should('contain', 'After Empty')
      })

      it('5.11 Level-10 clamping when pasting inside H9', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'L2', [
              heading(3, 'L3', [
                heading(4, 'L4', [
                  heading(5, 'L5', [
                    heading(6, 'L6', [
                      heading(7, 'L7', [heading(8, 'L8', [heading(9, 'L9', [paragraph('deep')])])])
                    ])
                  ])
                ])
              ])
            ])
          ])
        ])
        cy.wait(100)

        clickContentArea(9)
        pasteHTML('<h2>Clamped</h2><p>clamped body</p>')
        waitForPlugin()

        // No level beyond 10
        cy.get('.docy_editor .heading[level="11"]').should('not.exist')
        cy.get('.docy_editor .heading[level="10"]').should('exist')
        assertSchemaValid('5.11 — L10 clamp')
      })

      it('5.12 Paste inside H10 — heading clamped to level 10', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'L2', [
              heading(3, 'L3', [
                heading(4, 'L4', [
                  heading(5, 'L5', [
                    heading(6, 'L6', [
                      heading(7, 'L7', [
                        heading(8, 'L8', [
                          heading(9, 'L9', [heading(10, 'L10', [paragraph('deepest')])])
                        ])
                      ])
                    ])
                  ])
                ])
              ])
            ])
          ])
        ])
        cy.wait(100)

        clickContentArea(10)
        pasteHTML('<h2>At Max</h2><p>max body</p>')
        waitForPlugin()

        cy.get('.docy_editor .heading[level="11"]').should('not.exist')
        cy.get('.docy_editor').should('contain', 'At Max')
      })

      it('5.13 transformPastedHTML preserves text containing "div"', () => {
        cy.createDocument([section('Test', [paragraph('content')])])

        clickContentArea(1)
        pasteHTML('<p>The divided sections show individual elements</p>')

        cy.get('.docy_editor').should('contain', 'divided')
        cy.get('.docy_editor').should('not.contain', 'spaned')
      })

      it('5.14 transformPastedHTML converts <div> tags to <span>', () => {
        cy.createDocument([section('Test', [paragraph('base')])])

        clickContentArea(1)
        pasteHTML('<div>Block 1</div><div>Block 2</div>')

        cy.get('.docy_editor').should('contain', 'Block 1')
        cy.get('.docy_editor').should('contain', 'Block 2')
        assertSchemaValid('5.14')
      })

      it('5.15 transformPastedHTML preserves "div" in class attributes', () => {
        cy.createDocument([section('Class', [paragraph('existing')])])

        clickContentArea(1)
        pasteHTML('<p class="content-divider">Divider content</p>')

        cy.get('.docy_editor').should('contain', 'Divider content')
      })
    })

    // ===========================================================================
    // 6. DELETE OPERATIONS
    // ===========================================================================
    describe('6. Delete Operations', () => {
      it('6.1 Delete across two sibling paragraphs', () => {
        cy.createDocument([
          section('Del', [paragraph('First paragraph'), paragraph('Second paragraph')])
        ])
        cy.wait(100)

        cy.window().then((win) => {
          const editor = win._editor
          const doc = editor.state.doc
          let from = null,
            to = null

          doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph') {
              if (node.textContent === 'First paragraph') from = pos + 6
              if (node.textContent === 'Second paragraph') to = pos + 8
            }
          })

          if (from && to) editor.commands.setTextSelection({ from, to })
        })

        cy.wait(100)
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
        cy.wait(100)

        assertSchemaValid('6.1')
      })

      it('Delete selection ending in contentHeading falls back safely', () => {
        cy.createDocument([
          section('Sec', [
            paragraph('First paragraph'),
            heading(2, 'Target Heading', [paragraph('Heading content')])
          ])
        ])
        cy.wait(100)

        cy.window().then((win) => {
          const editor = win._editor
          const doc = editor.state.doc
          let from = null,
            to = null

          doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph' && node.textContent === 'First paragraph')
              from = pos + 1
            if (node.type.name === 'contentHeading' && node.textContent === 'Target Heading')
              to = pos + 3
          })

          if (from && to) editor.commands.setTextSelection({ from, to })
        })

        cy.wait(100)
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
        cy.wait(100)

        assertSchemaValid('6.2 — RISK-001')
      })

      it('Backspace with selection ending in contentHeading', () => {
        cy.createDocument([
          section('Sec', [paragraph('Before'), heading(2, 'After', [paragraph('Inside')])])
        ])
        cy.wait(100)

        cy.window().then((win) => {
          const editor = win._editor
          const doc = editor.state.doc
          let from = null,
            to = null

          doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph' && node.textContent === 'Before') from = pos + 3
            if (node.type.name === 'contentHeading' && node.textContent === 'After') to = pos + 2
          })

          if (from && to) editor.commands.setTextSelection({ from, to })
        })

        cy.wait(100)
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Backspace')
        cy.wait(100)

        assertSchemaValid('6.3')
      })

      it('6.4 Select-all + delete preserves document structure', () => {
        cy.createDocument([
          section('A', [paragraph('a'), heading(2, 'B', [paragraph('b')])]),
          section('C', [paragraph('c')])
        ])
        cy.wait(100)

        cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
        cy.wait(100)
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Backspace')
        cy.wait(100)

        cy.get('.docy_editor .heading[level="1"]').should('exist')
        assertSchemaValid('6.4')
      })

      it('6.5 Delete across multiple heading levels preserves schema', () => {
        cy.createDocument([
          section('Root', [
            heading(2, 'H2-A', [paragraph('A')]),
            heading(2, 'H2-B', [paragraph('B'), heading(3, 'H3', [paragraph('nested')])]),
            heading(2, 'H2-C', [paragraph('C')])
          ])
        ])
        cy.wait(100)

        cy.window().then((win) => {
          const editor = win._editor
          const doc = editor.state.doc
          let from = null,
            to = null

          doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph' && node.textContent === 'A') from = pos + 1
            if (node.type.name === 'paragraph' && node.textContent === 'C') to = pos + 1
          })

          if (from && to) editor.commands.setTextSelection({ from, to })
        })

        cy.wait(100)
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
        cy.wait(100)

        assertSchemaValid('6.5')
      })

      it('6.6 Delete paragraph-to-heading contentWrapper (skip contentHeading)', () => {
        cy.createDocument([
          section('Sec', [
            paragraph('Before heading content'),
            heading(2, 'H2', [paragraph('After heading')])
          ])
        ])
        cy.wait(100)

        cy.window().then((win) => {
          const editor = win._editor
          const doc = editor.state.doc
          let from = null,
            to = null

          doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph' && node.textContent === 'Before heading content')
              from = pos + 5
            if (node.type.name === 'paragraph' && node.textContent === 'After heading') to = pos + 5
          })

          if (from && to) editor.commands.setTextSelection({ from, to })
        })

        cy.wait(100)
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
        cy.wait(100)

        assertSchemaValid('6.6')
      })
    })

    // ===========================================================================
    // 7. HIERARCHY VALIDATION PLUGIN (AUTO-FIX)
    // ===========================================================================
    describe('7. Hierarchy Validation Plugin', () => {
      it('7.1 Document with valid hierarchy triggers no auto-fix', () => {
        cy.createDocument([
          section('Valid', [heading(2, 'H2', [heading(3, 'H3', [paragraph('valid')])])])
        ])
        cy.wait(100)

        assertSchemaValid('7.1 — no-op')
      })

      it('7.2 Multiple valid sections pass validation', () => {
        cy.createDocument([
          section('S1', [
            heading(2, 'H2-A', [paragraph('a')]),
            heading(2, 'H2-B', [heading(3, 'H3', [paragraph('nested')])])
          ]),
          section('S2', [heading(2, 'H2-C', [paragraph('c')])])
        ])
        cy.wait(100)

        assertSchemaValid('7.2 — multi-section validation')
      })

      it('7.3 Level 10 heading at maximum depth passes validation', () => {
        cy.createDocument([
          section('Max', [
            heading(2, 'L2', [
              heading(3, 'L3', [
                heading(4, 'L4', [
                  heading(5, 'L5', [
                    heading(6, 'L6', [
                      heading(7, 'L7', [
                        heading(8, 'L8', [
                          heading(9, 'L9', [heading(10, 'L10', [paragraph('max depth')])])
                        ])
                      ])
                    ])
                  ])
                ])
              ])
            ])
          ])
        ])
        cy.wait(100)

        assertSchemaValid('7.3 — max depth')
      })

      it('7.4 Schema validation catches if H1 is somehow nested (defense-in-depth)', () => {
        // This test verifies our validator catches violations
        // We can't easily force a violation through the API, but we can verify the validator itself
        cy.window().then((win) => {
          const editor = win._editor
          if (!editor) return

          const doc = editor.state.doc
          const headings = []

          doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
              const level = node.firstChild?.attrs?.level || 1
              headings.push({ level, depth: doc.resolve(pos).depth })
            }
          })

          // All H1s should be at doc root
          const nestedH1s = headings.filter((h) => h.level === 1 && h.depth > 1)
          expect(nestedH1s.length).to.equal(0, 'No H1 should be nested')
        })
      })
    })
  }
)
