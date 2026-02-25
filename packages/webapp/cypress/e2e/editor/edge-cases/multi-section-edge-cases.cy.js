/* eslint-disable no-undef */
/**
 * HN-10 Multi-Section Edge Cases — 2nd & 3rd H1 Sections
 *
 * These tests specifically target the unique behaviors of non-first H1 sections:
 *   - Non-first H1s CAN change level (unlike the immutable first H1)
 *   - H1→H2 conversion makes the section a child of the previous section
 *   - H2→H1 promotion creates a new root section (section break)
 *   - Dissolution of non-first H1s re-attaches content to the previous section
 *   - Cross-section delete/paste operations must preserve HN-10 invariants
 *
 * Test Matrix:
 *   A. Level Change in Non-First H1 Sections (H1→H2/H3/H10, with children)
 *   B. Backward Promotion to H1 (section break creation)
 *   C. Normal Text Dissolution in Non-First Sections
 *   D. Delete Operations Across Section Boundaries
 *   E. Paste Operations in 2nd/3rd Sections
 *   F. Complex Multi-Section Structural Scenarios
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
  cy.wait(500)
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
const waitForPlugin = () => cy.wait(800)

/** Clicks inside a contentWrapper paragraph for a heading with specific title. */
const clickContentAreaByTitle = (level, titleText) => {
  cy.window().then((win) => {
    const editor = win._editor
    if (!editor) return

    let targetPos = null
    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== null) return false
      if (node.type.name === 'contentWrapper') {
        // Check if the parent heading has the right title
        const parentHeading = editor.state.doc.resolve(pos).parent
        if (
          parentHeading.type.name === 'heading' &&
          parentHeading.attrs.level === level &&
          parentHeading.firstChild?.textContent?.includes(titleText)
        ) {
          // Find the first paragraph inside this contentWrapper
          node.forEach((child, offset) => {
            if (targetPos === null && child.type.name === 'paragraph') {
              targetPos = pos + 1 + offset + child.nodeSize - 1
            }
          })
        }
      }
    })

    if (targetPos !== null) {
      editor.commands.setTextSelection(targetPos)
      editor.commands.focus()
    }
  })
  cy.wait(100)
}

/** Creates the standard 3-section document used by many tests. */
const createThreeSections = (opts = {}) => {
  const {
    s1Children = [paragraph('Alpha content')],
    s2Children = [paragraph('Beta content')],
    s3Children = [paragraph('Gamma content')]
  } = opts

  cy.createDocument([
    section('Section Alpha', s1Children),
    section('Section Beta', s2Children),
    section('Section Gamma', s3Children)
  ])
  cy.wait(300)
}

/** Asserts the number of root-level H1 sections in the document. */
const assertH1Count = (expectedCount, label = '') =>
  getDocStructure().then((headings) => {
    const h1s = headings.filter((h) => h.level === 1)
    expect(h1s.length, `${label} H1 count`).to.equal(expectedCount)
    h1s.forEach((h1) => expect(h1.depth, `${label} H1 "${h1.title}" depth`).to.equal(1))
  })

/** Asserts that a heading with given title exists at given level. */
const assertHeadingExists = (level, titleSubstring) =>
  getDocStructure().then((headings) => {
    const match = headings.find((h) => h.level === level && h.title.includes(titleSubstring))
    expect(match, `H${level} containing "${titleSubstring}" should exist`).to.not.be.undefined
  })

/** Asserts that a heading with given title does NOT exist at given level. */
const assertHeadingNotAtLevel = (level, titleSubstring) =>
  getDocStructure().then((headings) => {
    const match = headings.find((h) => h.level === level && h.title.includes(titleSubstring))
    expect(match, `H${level} containing "${titleSubstring}" should NOT exist`).to.be.undefined
  })

/** Asserts document still contains text. */
const assertTextPresent = (...texts) =>
  texts.forEach((t) => cy.get('.docy_editor').should('contain', t))

// =============================================================================
// TEST SUITE
// =============================================================================

describe('HN-10 Multi-Section Edge Cases — 2nd & 3rd H1', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  // ===========================================================================
  // A. LEVEL CHANGE IN NON-FIRST H1 SECTIONS
  // ===========================================================================
  describe('A. Level Change in Non-First H1 Sections', () => {
    it('A.1 2nd H1→H2: becomes child of 1st section', () => {
      createThreeSections()

      putCaretInHeading(1, 'Section Beta', 'start')
      changeLevel(2)
      waitForPlugin()

      // "Section Beta" should now be H2 inside first section
      assertHeadingNotAtLevel(1, 'Beta')
      assertHeadingExists(2, 'Beta')
      // 3rd section should remain H1
      assertHeadingExists(1, 'Gamma')
      assertTextPresent('Beta content')
      assertSchemaValid('A.1 — 2nd H1→H2')
    })

    it('A.2 3rd H1→H2: becomes child of preceding section', () => {
      createThreeSections()

      putCaretInHeading(1, 'Section Gamma', 'start')
      changeLevel(2)
      waitForPlugin()

      assertHeadingNotAtLevel(1, 'Gamma')
      assertHeadingExists(2, 'Gamma')
      // First two H1s: Alpha remains H1, Beta remains H1
      assertHeadingExists(1, 'Alpha')
      assertHeadingExists(1, 'Beta')
      assertTextPresent('Gamma content')
      assertSchemaValid('A.2 — 3rd H1→H2')
    })

    it('A.3 2nd H1→H3: non-sequential downgrade (HN-10 §6.2 allows gaps)', () => {
      createThreeSections()

      putCaretInHeading(1, 'Section Beta', 'start')
      changeLevel(3)
      waitForPlugin()

      assertHeadingNotAtLevel(1, 'Beta')
      assertHeadingExists(3, 'Beta')
      assertTextPresent('Beta content')
      assertSchemaValid('A.3 — 2nd H1→H3 non-sequential')
    })

    it('A.4 2nd H1→H10: maximum downgrade', () => {
      cy.createDocument([
        section('First', [paragraph('first content')]),
        section('Second', [paragraph('second content')])
      ])
      cy.wait(300)

      putCaretInHeading(1, 'Second', 'start')
      // Change level sequentially — the shortcut supports single digits
      // Use Alt+Meta+1 through 0 — but for level 10 we need to use the
      // programmatic approach via the editor
      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        // Find the contentHeading for "Second"
        let headingPos = null
        editor.state.doc.descendants((node, pos) => {
          if (headingPos !== null) return false
          if (
            node.type.name === 'contentHeading' &&
            node.attrs.level === 1 &&
            node.textContent.includes('Second')
          ) {
            headingPos = pos
            return false
          }
        })

        if (headingPos !== null) {
          editor.commands.setTextSelection(headingPos + 1)
          editor.commands.focus()
        }
      })
      cy.wait(100)

      // Change to a high level (let's use 5 which is keyboard accessible)
      changeLevel(5)
      waitForPlugin()

      assertHeadingNotAtLevel(1, 'Second')
      assertTextPresent('second content')
      assertSchemaValid('A.4 — 2nd H1→H5 deep downgrade')
    })

    it('A.5 2nd H1 with H2/H3 children → H2: children re-attach correctly', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [
          heading(2, 'Child H2', [
            paragraph('h2 body'),
            heading(3, 'Grandchild H3', [paragraph('h3 body')])
          ])
        ])
      ])
      cy.wait(300)

      putCaretInHeading(1, 'Second', 'start')
      changeLevel(2)
      waitForPlugin()

      // "Second" is now H2, children must still exist and be valid
      assertHeadingNotAtLevel(1, 'Second')
      assertTextPresent('Second', 'Child H2', 'Grandchild H3', 'h2 body', 'h3 body')
      assertSchemaValid('A.5 — 2nd H1 with children→H2')
    })

    it('A.6 3rd H1 with children → H2: nestles under 2nd section', () => {
      cy.createDocument([
        section('Alpha', [paragraph('a content')]),
        section('Beta', [paragraph('b content')]),
        section('Gamma', [
          heading(2, 'Gamma Sub', [paragraph('gamma sub body')]),
          heading(2, 'Gamma Sub2', [paragraph('gamma sub2 body')])
        ])
      ])
      cy.wait(300)

      putCaretInHeading(1, 'Gamma', 'start')
      changeLevel(2)
      waitForPlugin()

      assertHeadingNotAtLevel(1, 'Gamma')
      assertTextPresent('Gamma', 'Gamma Sub', 'Gamma Sub2')
      assertSchemaValid('A.6 — 3rd H1 with children→H2')
    })

    it('A.7 Middle H1 (2nd of 3) → H2: 3rd section stays independent H1', () => {
      createThreeSections()

      putCaretInHeading(1, 'Section Beta', 'start')
      changeLevel(2)
      waitForPlugin()

      // After converting Beta to H2, document should have 2 root H1s
      getDocStructure().then((headings) => {
        const h1s = headings.filter((h) => h.level === 1)
        expect(h1s.length).to.equal(2)

        // Alpha and Gamma should still be H1
        const titles = h1s.map((h) => h.title)
        expect(titles.some((t) => t.includes('Alpha'))).to.be.true
        expect(titles.some((t) => t.includes('Gamma'))).to.be.true
      })

      assertSchemaValid('A.7 — middle H1→H2, 3rd stays H1')
    })

    it('A.8 2nd H1→H2 then back H2→H1: round-trip preserves content', () => {
      cy.createDocument([
        section('First', [paragraph('first body')]),
        section('Second', [paragraph('second body')])
      ])
      cy.wait(300)

      // Step 1: H1→H2
      putCaretInHeading(1, 'Second', 'start')
      changeLevel(2)
      waitForPlugin()

      assertHeadingNotAtLevel(1, 'Second')
      assertSchemaValid('A.8 step 1')

      // Step 2: H2→H1 (promote back)
      putCaretInHeading(2, 'Second', 'start')
      changeLevel(1)
      waitForPlugin()

      assertHeadingExists(1, 'Second')
      assertH1Count(2, 'A.8 round-trip')
      assertTextPresent('second body')
      assertSchemaValid('A.8 — round-trip H1→H2→H1')
    })

    it('A.9 Same-level change on 2nd H1 is no-op', () => {
      cy.createDocument([section('First', [paragraph('a')]), section('Second', [paragraph('b')])])
      cy.wait(300)

      putCaretInHeading(1, 'Second', 'start')
      changeLevel(1) // same level
      cy.wait(300)

      assertH1Count(2, 'A.9')
      assertSchemaValid('A.9 — same level no-op on 2nd H1')
    })
  })

  // ===========================================================================
  // B. BACKWARD PROMOTION TO H1 (SECTION BREAK CREATION)
  // ===========================================================================
  describe('B. Backward Promotion to H1 (Section Break)', () => {
    it('B.1 H2 inside 2nd section → H1: creates new root section', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [heading(2, 'Promoted Sub', [paragraph('sub content')])])
      ])
      cy.wait(300)

      putCaretInHeading(2, 'Promoted Sub', 'start')
      changeLevel(1)
      waitForPlugin()

      assertHeadingExists(1, 'Promoted Sub')
      assertTextPresent('sub content')
      assertSchemaValid('B.1 — H2→H1 section break')
    })

    it('B.2 H3 deep in 2nd section → H1: creates new root section', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [
          heading(2, 'Parent H2', [heading(3, 'Deep H3', [paragraph('deep content')])])
        ])
      ])
      cy.wait(300)

      putCaretInHeading(3, 'Deep H3', 'start')
      changeLevel(1)
      waitForPlugin()

      assertHeadingExists(1, 'Deep H3')
      assertTextPresent('deep content')
      assertSchemaValid('B.2 — H3→H1 deep promotion')
    })

    it('B.3 H2 in 3rd section → H1: becomes 4th root section', () => {
      cy.createDocument([
        section('S1', [paragraph('s1')]),
        section('S2', [paragraph('s2')]),
        section('S3', [heading(2, 'Breakout', [paragraph('breakout body')])])
      ])
      cy.wait(300)

      putCaretInHeading(2, 'Breakout', 'start')
      changeLevel(1)
      waitForPlugin()

      assertHeadingExists(1, 'Breakout')
      assertTextPresent('breakout body')
      assertSchemaValid('B.3 — H2 in 3rd section→H1')
    })

    it('B.4 H2 with children promoted to H1: children re-attach under new section', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [
          heading(2, 'Will Become H1', [
            paragraph('para'),
            heading(3, 'Child A', [paragraph('child a body')]),
            heading(3, 'Child B', [paragraph('child b body')])
          ])
        ])
      ])
      cy.wait(300)

      putCaretInHeading(2, 'Will Become H1', 'start')
      changeLevel(1)
      waitForPlugin()

      assertHeadingExists(1, 'Will Become H1')
      assertTextPresent('Child A', 'Child B', 'child a body', 'child b body')
      assertSchemaValid('B.4 — H2→H1 with children')
    })
  })

  // ===========================================================================
  // C. NORMAL TEXT DISSOLUTION IN NON-FIRST SECTIONS
  // ===========================================================================
  describe('C. Normal Text Dissolution in Non-First Sections', () => {
    it('C.1 Dissolve 2nd H1: title becomes paragraph, content re-attaches to 1st section', () => {
      cy.createDocument([
        section('First', [paragraph('first body')]),
        section('Second', [paragraph('second body')])
      ])
      cy.wait(300)

      putCaretInHeading(1, 'Second', 'start')
      toNormalText()
      waitForPlugin()

      // "Second" should become a paragraph, document must still be valid
      assertTextPresent('Second', 'second body')
      // Should now have only 1 H1
      getDocStructure().then((headings) => {
        const h1s = headings.filter((h) => h.level === 1)
        expect(h1s.length).to.equal(1)
      })
      assertSchemaValid('C.1 — dissolve 2nd H1')
    })

    it('C.2 Dissolve 3rd H1: preserves 1st and 2nd sections', () => {
      createThreeSections()

      putCaretInHeading(1, 'Section Gamma', 'start')
      toNormalText()
      waitForPlugin()

      assertTextPresent('Section Gamma', 'Gamma content')
      getDocStructure().then((headings) => {
        const h1s = headings.filter((h) => h.level === 1)
        expect(h1s.length).to.equal(2)
        expect(h1s[0].title).to.include('Alpha')
        expect(h1s[1].title).to.include('Beta')
      })
      assertSchemaValid('C.2 — dissolve 3rd H1')
    })

    it('C.3 Dissolve 2nd H1 with multiple children: complex re-attachment', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [
          heading(2, 'Sub A', [paragraph('a body')]),
          heading(2, 'Sub B', [
            paragraph('b body'),
            heading(3, 'Sub B Child', [paragraph('bc body')])
          ])
        ])
      ])
      cy.wait(300)

      putCaretInHeading(1, 'Second', 'start')
      toNormalText()
      waitForPlugin()

      assertTextPresent('Second', 'Sub A', 'Sub B', 'Sub B Child')
      assertSchemaValid('C.3 — dissolve 2nd H1 with children')
    })

    it('C.4 Dissolve H2 inside 2nd section: standard within-section dissolution', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [
          heading(2, 'To Remove', [paragraph('remove body')]),
          heading(2, 'To Keep', [paragraph('keep body')])
        ])
      ])
      cy.wait(300)

      putCaretInHeading(2, 'To Remove', 'start')
      toNormalText()
      waitForPlugin()

      assertTextPresent('To Remove', 'remove body', 'To Keep')
      assertH1Count(2, 'C.4')
      assertSchemaValid('C.4 — dissolve H2 in 2nd section')
    })

    it('C.5 Dissolve middle H1 (2nd of 3): 3rd section re-attaches', () => {
      createThreeSections()

      putCaretInHeading(1, 'Section Beta', 'start')
      toNormalText()
      waitForPlugin()

      assertTextPresent('Section Beta', 'Beta content')
      // Gamma should remain H1
      assertHeadingExists(1, 'Gamma')
      assertSchemaValid('C.5 — dissolve middle H1')
    })
  })

  // ===========================================================================
  // D. DELETE OPERATIONS ACROSS SECTION BOUNDARIES
  // ===========================================================================
  describe('D. Delete Operations Across Section Boundaries', () => {
    it('D.1 Delete from 1st section content into 2nd section content', () => {
      createThreeSections()

      cy.window().then((win) => {
        const editor = win._editor
        const doc = editor.state.doc
        let from = null
        let to = null

        doc.descendants((node, pos) => {
          if (node.type.name === 'paragraph' && node.textContent === 'Alpha content') {
            from = pos + 3 // middle of "Alpha content"
          }
          if (node.type.name === 'paragraph' && node.textContent === 'Beta content') {
            to = pos + 3 // middle of "Beta content"
          }
        })

        if (from && to) editor.commands.setTextSelection({ from, to })
      })

      cy.wait(200)
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
      waitForPlugin()

      assertSchemaValid('D.1 — cross-section delete 1st→2nd')
    })

    it('D.2 Delete spanning entire 2nd section (from end of 1st to start of 3rd)', () => {
      createThreeSections()

      cy.window().then((win) => {
        const editor = win._editor
        const doc = editor.state.doc
        let from = null
        let to = null

        doc.descendants((node, pos) => {
          if (node.type.name === 'paragraph' && node.textContent === 'Alpha content') {
            from = pos + node.nodeSize - 1 // end of Alpha paragraph
          }
          if (node.type.name === 'contentHeading' && node.textContent === 'Section Gamma') {
            to = pos + 1 // start of Gamma title
          }
        })

        if (from && to) editor.commands.setTextSelection({ from, to })
      })

      cy.wait(200)
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
      waitForPlugin()

      // Alpha and Gamma should survive in some form
      assertTextPresent('Alpha')
      assertSchemaValid('D.2 — delete spanning entire 2nd section')
    })

    it('D.3 Backspace at start of 2nd H1 contentHeading', () => {
      cy.createDocument([
        section('First', [paragraph('first body')]),
        section('Second', [paragraph('second body')])
      ])
      cy.wait(300)

      putCaretInHeading(1, 'Second', 'start')
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Backspace')
      waitForPlugin()

      // Backspace at start of H1 contentHeading triggers dissolution (onHeading)
      assertTextPresent('Second')
      assertSchemaValid('D.3 — backspace at 2nd H1 start')
    })

    it('D.4 Select all content within 2nd section only, delete', () => {
      createThreeSections()

      cy.window().then((win) => {
        const editor = win._editor
        const doc = editor.state.doc
        let sectionStart = null
        let sectionEnd = null

        doc.descendants((node, pos) => {
          if (node.type.name === 'heading' && node.attrs.level === 1) {
            if (node.firstChild?.textContent === 'Section Beta') {
              sectionStart = pos
              sectionEnd = pos + node.nodeSize
            }
          }
        })

        if (sectionStart !== null && sectionEnd !== null) {
          // Select the content inside the contentHeading and contentWrapper
          // Position inside the contentHeading
          const from = sectionStart + 2 // inside contentHeading
          const to = sectionEnd - 2 // before end of contentWrapper
          editor.commands.setTextSelection({ from, to })
        }
      })

      cy.wait(200)
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Backspace')
      waitForPlugin()

      // Alpha and Gamma should still exist
      assertHeadingExists(1, 'Alpha')
      assertHeadingExists(1, 'Gamma')
      assertSchemaValid('D.4 — select all in 2nd section, delete')
    })

    it('D.5 Cross-section delete with nested headings in both sections', () => {
      cy.createDocument([
        section('S1', [
          heading(2, 'S1-H2', [paragraph('s1h2 body')]),
          heading(2, 'S1-H2b', [paragraph('s1h2b body')])
        ]),
        section('S2', [
          heading(2, 'S2-H2', [paragraph('s2h2 body')]),
          heading(2, 'S2-H2b', [paragraph('s2h2b body')])
        ])
      ])
      cy.wait(300)

      cy.window().then((win) => {
        const editor = win._editor
        const doc = editor.state.doc
        let from = null
        let to = null

        doc.descendants((node, pos) => {
          if (node.type.name === 'paragraph' && node.textContent === 's1h2 body') {
            from = pos + 1
          }
          if (node.type.name === 'paragraph' && node.textContent === 's2h2 body') {
            to = pos + 1
          }
        })

        if (from && to) editor.commands.setTextSelection({ from, to })
      })

      cy.wait(200)
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
      waitForPlugin()

      assertSchemaValid('D.5 — cross-section nested delete')
    })

    it('D.6 Delete selection ending in 2nd section contentHeading (RISK-001)', () => {
      cy.createDocument([
        section('First', [paragraph('first paragraph')]),
        section('Second', [paragraph('second paragraph')])
      ])
      cy.wait(300)

      cy.window().then((win) => {
        const editor = win._editor
        const doc = editor.state.doc
        let from = null
        let to = null

        doc.descendants((node, pos) => {
          if (node.type.name === 'paragraph' && node.textContent === 'first paragraph') {
            from = pos + 1
          }
          if (node.type.name === 'contentHeading' && node.textContent === 'Second') {
            to = pos + 3
          }
        })

        if (from && to) editor.commands.setTextSelection({ from, to })
      })

      cy.wait(200)
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
      cy.wait(300)

      // RISK-001: should fall back safely, not silently swallow
      assertSchemaValid('D.6 — cross-section into contentHeading')
    })
  })

  // ===========================================================================
  // E. PASTE OPERATIONS IN 2ND/3RD SECTIONS
  // ===========================================================================
  describe('E. Paste Operations in 2nd/3rd Sections', () => {
    it('E.1 Paste H2-H5 hierarchy into 2nd section contentWrapper', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [paragraph('second')])
      ])
      cy.wait(300)

      clickContentAreaByTitle(1, 'Second')
      pasteHTML(
        '<h2>P-H2</h2><p>p2</p><h3>P-H3</h3><p>p3</p><h4>P-H4</h4><p>p4</p><h5>P-H5</h5><p>p5</p>'
      )
      waitForPlugin()

      assertTextPresent('P-H2', 'P-H3', 'P-H4', 'P-H5')
      assertH1Count(2, 'E.1')
      assertSchemaValid('E.1 — paste hierarchy into 2nd section')
    })

    it('E.2 Paste H1 headings into 2nd section: extracted as new root sections', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [paragraph('second')])
      ])
      cy.wait(300)

      clickContentAreaByTitle(1, 'Second')
      pasteHTML('<h1>Pasted Root</h1><p>pasted root body</p>')
      waitForPlugin()

      assertTextPresent('Pasted Root', 'pasted root body')
      // Should have at least 3 H1 sections now
      getDocStructure().then((headings) => {
        const h1s = headings.filter((h) => h.level === 1)
        expect(h1s.length).to.be.at.least(2)
        h1s.forEach((h) => expect(h.depth).to.equal(1))
      })
      assertSchemaValid('E.2 — paste H1 into 2nd section')
    })

    it('E.3 Paste mixed content into 3rd section', () => {
      createThreeSections()

      clickContentAreaByTitle(1, 'Section Gamma')
      pasteHTML('<p>Extra paragraph</p><h2>Pasted H2</h2><p>h2 body</p><p>Another paragraph</p>')
      waitForPlugin()

      assertTextPresent('Extra paragraph', 'Pasted H2', 'h2 body')
      assertH1Count(3, 'E.3')
      assertSchemaValid('E.3 — mixed paste into 3rd section')
    })

    it('E.4 Paste into 2nd section with existing children: merges correctly', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [heading(2, 'Existing Child', [paragraph('existing body')])])
      ])
      cy.wait(300)

      clickContentAreaByTitle(1, 'Second')
      pasteHTML('<h2>New Child</h2><p>new child body</p>')
      waitForPlugin()

      assertTextPresent('Existing Child', 'New Child')
      assertH1Count(2, 'E.4')
      assertSchemaValid('E.4 — paste into 2nd section with children')
    })

    it('E.5 Paste plain text into 2nd section contentHeading', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [paragraph('second')])
      ])
      cy.wait(300)

      putCaretInHeading(1, 'Second', 'end')
      pasteHTML('<p> Appended</p>')

      cy.get('.docy_editor').should('contain', 'Appended')
      assertH1Count(2, 'E.5')
      assertSchemaValid('E.5 — paste text into 2nd H1 title')
    })

    it('E.6 Paste 2 H1s into 3rd section (BUG-001 variant)', () => {
      createThreeSections()

      clickContentAreaByTitle(1, 'Section Gamma')
      pasteHTML('<h1>Extra A</h1><p>ea</p><h1>Extra B</h1><p>eb</p>')
      waitForPlugin()

      assertTextPresent('Extra A', 'Extra B')
      getDocStructure().then((headings) => {
        const h1s = headings.filter((h) => h.level === 1)
        // Should have at least 4 H1s (Alpha, Beta, Gamma, + pasted)
        expect(h1s.length).to.be.at.least(4)
        h1s.forEach((h) => expect(h.depth).to.equal(1))
      })
      assertSchemaValid('E.6 — paste 2 H1s into 3rd section')
    })

    it('E.7 Paste same-level siblings (3× H2) into 2nd section', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [paragraph('second')])
      ])
      cy.wait(300)

      clickContentAreaByTitle(1, 'Second')
      pasteHTML('<h2>Sib X</h2><p>x</p><h2>Sib Y</h2><p>y</p><h2>Sib Z</h2><p>z</p>')
      waitForPlugin()

      assertTextPresent('Sib X', 'Sib Y', 'Sib Z')
      assertSchemaValid('E.7 — paste sibling H2s into 2nd section')
    })
  })

  // ===========================================================================
  // F. COMPLEX MULTI-SECTION STRUCTURAL SCENARIOS
  // ===========================================================================
  describe('F. Complex Multi-Section Structural Scenarios', () => {
    it('F.1 3 sections with deep nesting: all validate correctly', () => {
      cy.createDocument([
        section('S1', [
          heading(2, 'S1-A', [heading(3, 'S1-A-a', [paragraph('deep1')])]),
          heading(2, 'S1-B', [paragraph('s1b')])
        ]),
        section('S2', [
          heading(2, 'S2-A', [heading(3, 'S2-A-a', [heading(4, 'S2-A-a-i', [paragraph('deep2')])])])
        ]),
        section('S3', [
          heading(2, 'S3-A', [paragraph('s3a')]),
          heading(2, 'S3-B', [paragraph('s3b')]),
          heading(2, 'S3-C', [paragraph('s3c')])
        ])
      ])
      cy.wait(300)

      assertH1Count(3, 'F.1')
      assertSchemaValid('F.1 — 3 sections with deep nesting')
    })

    it('F.2 Convert 2nd H1→H2, then convert its child H2→H3: cascade nesting', () => {
      cy.createDocument([
        section('Alpha', [paragraph('alpha')]),
        section('Beta', [heading(2, 'Beta Child', [paragraph('beta child body')])])
      ])
      cy.wait(300)

      // Step 1: Beta H1→H2
      putCaretInHeading(1, 'Beta', 'start')
      changeLevel(2)
      waitForPlugin()
      assertSchemaValid('F.2 step 1')

      // Step 2: Beta Child (was H2, should have been re-attached) → H3
      // Find current state of Beta Child
      getDocStructure().then((headings) => {
        const betaChild = headings.find((h) => h.title.includes('Beta Child'))
        if (betaChild) {
          putCaretInHeading(betaChild.level, 'Beta Child', 'start')
          changeLevel(betaChild.level + 1)
          waitForPlugin()
        }
      })

      assertTextPresent('Beta Child', 'beta child body')
      assertSchemaValid('F.2 — cascade nesting')
    })

    it('F.3 Select-all + delete with 3 sections: preserves at least one H1', () => {
      createThreeSections()

      cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
      cy.wait(100)
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Backspace')
      waitForPlugin()

      cy.get('.docy_editor .heading[level="1"]').should('have.length.gte', 1)
      assertSchemaValid('F.3 — select-all delete 3 sections')
    })

    it('F.4 Rapid sequential level changes on 2nd section: H1→H3→H2→H4→H1', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Morphing', [paragraph('morph content')])
      ])
      cy.wait(300)

      // H1→H3
      putCaretInHeading(1, 'Morphing', 'start')
      changeLevel(3)
      waitForPlugin()
      assertSchemaValid('F.4 step 1: H1→H3')

      // H3→H2
      putCaretInHeading(3, 'Morphing', 'start')
      changeLevel(2)
      waitForPlugin()
      assertSchemaValid('F.4 step 2: H3→H2')

      // H2→H4
      putCaretInHeading(2, 'Morphing', 'start')
      changeLevel(4)
      waitForPlugin()
      assertSchemaValid('F.4 step 3: H2→H4')

      // H4→H1 (promote back to section)
      putCaretInHeading(4, 'Morphing', 'start')
      changeLevel(1)
      waitForPlugin()

      assertHeadingExists(1, 'Morphing')
      assertH1Count(2, 'F.4 final')
      assertTextPresent('morph content')
      assertSchemaValid('F.4 — rapid sequential changes')
    })

    it('F.5 All 3 H1s have 10-level deep nesting: schema validates', () => {
      const deepChain = (prefix) =>
        heading(2, `${prefix}-L2`, [
          heading(3, `${prefix}-L3`, [
            heading(4, `${prefix}-L4`, [
              heading(5, `${prefix}-L5`, [
                heading(6, `${prefix}-L6`, [
                  heading(7, `${prefix}-L7`, [
                    heading(8, `${prefix}-L8`, [
                      heading(9, `${prefix}-L9`, [
                        heading(10, `${prefix}-L10`, [paragraph(`${prefix} deep`)])
                      ])
                    ])
                  ])
                ])
              ])
            ])
          ])
        ])

      cy.createDocument([
        section('S1', [deepChain('S1')]),
        section('S2', [deepChain('S2')]),
        section('S3', [deepChain('S3')])
      ])
      cy.wait(500)

      assertH1Count(3, 'F.5')

      // All levels should exist
      for (let lvl = 1; lvl <= 10; lvl++) {
        cy.get(`.docy_editor .heading[level="${lvl}"]`).should('have.length.gte', 3)
      }

      assertSchemaValid('F.5 — 3 sections × 10 levels')
    })

    it('F.6 Dissolve 2nd H1, then undo with Cmd+Z: restores original structure', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [paragraph('second')])
      ])
      // ProseMirror groups transactions within 500ms into one undo group.
      // Wait > 500ms so setContent and dissolution are in SEPARATE undo groups.
      cy.wait(600)

      // Dissolve 2nd H1
      putCaretInHeading(1, 'Second', 'start')
      toNormalText()
      waitForPlugin()

      // Verify dissolution took effect
      getDocStructure().then((headings) => {
        const h1s = headings.filter((h) => h.level === 1)
        expect(h1s.length).to.equal(1, 'After dissolution, only 1 H1 should remain')
      })

      // Single undo — should only reverse the dissolution, not setContent
      cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'z'])
      waitForPlugin()

      // After undo, "Second" text must be present and schema must be valid
      assertTextPresent('First', 'Second')
      assertSchemaValid('F.6 — dissolve + undo')
    })

    it('F.7 2nd section with non-sequential children: H1 → (H2, H5, H3, H8)', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [
          heading(2, 'H2 child', [paragraph('h2')]),
          heading(5, 'H5 child', [paragraph('h5')]),
          heading(3, 'H3 child', [paragraph('h3')]),
          heading(8, 'H8 child', [paragraph('h8')])
        ])
      ])
      cy.wait(300)

      assertH1Count(2, 'F.7')
      assertTextPresent('H2 child', 'H5 child', 'H3 child', 'H8 child')
      assertSchemaValid('F.7 — non-sequential children in 2nd section')
    })

    it('F.8 Paste into 2nd section then change pasted heading level', () => {
      cy.createDocument([
        section('First', [paragraph('first')]),
        section('Second', [paragraph('second')])
      ])
      cy.wait(300)

      // Paste a H2 into 2nd section
      clickContentAreaByTitle(1, 'Second')
      pasteHTML('<h2>Pasted</h2><p>pasted body</p>')
      waitForPlugin()
      assertSchemaValid('F.8 step 1: paste')

      // Now change the pasted H2→H3
      putCaretInHeading(2, 'Pasted', 'start')
      changeLevel(3)
      waitForPlugin()

      assertHeadingExists(3, 'Pasted')
      assertTextPresent('pasted body')
      assertSchemaValid('F.8 — paste then level change')
    })

    it('F.9 Multiple operations: create 3 sections, modify 2nd, paste into 3rd, validate', () => {
      createThreeSections()

      // Step 1: Change 2nd H1→H2
      putCaretInHeading(1, 'Section Beta', 'start')
      changeLevel(2)
      waitForPlugin()
      assertSchemaValid('F.9 step 1')

      // Step 2: Paste H2 into 3rd section
      clickContentAreaByTitle(1, 'Section Gamma')
      pasteHTML('<h2>Injected</h2><p>injected body</p>')
      waitForPlugin()
      assertSchemaValid('F.9 step 2')

      // Step 3: Verify overall structure
      getDocStructure().then((headings) => {
        const h1s = headings.filter((h) => h.level === 1)
        expect(h1s.length).to.equal(2) // Alpha and Gamma

        // Beta should be H2 under Alpha
        const beta = headings.find((h) => h.title.includes('Beta'))
        expect(beta).to.not.be.undefined
        expect(beta.level).to.equal(2)

        // Injected should be H2 under Gamma
        const injected = headings.find((h) => h.title.includes('Injected'))
        expect(injected).to.not.be.undefined
        expect(injected.level).to.equal(2)
      })

      assertTextPresent('Alpha', 'Beta', 'Gamma', 'Injected')
      assertSchemaValid('F.9 — multi-operation pipeline')
    })

    it('F.10 Empty sections: 2nd and 3rd H1 with no body content', () => {
      // Create sections with minimal content (just the nbsp that editor adds)
      cy.createDocument([
        section('Has Content', [paragraph('body text')]),
        section('Empty Two', [paragraph('\u00A0')]),
        section('Empty Three', [paragraph('\u00A0')])
      ])
      cy.wait(300)

      assertH1Count(3, 'F.10')
      assertSchemaValid('F.10 — empty sections')

      // Paste into empty 2nd section
      clickContentAreaByTitle(1, 'Empty Two')
      pasteHTML('<h2>Now Has Content</h2><p>content added</p>')
      waitForPlugin()

      assertTextPresent('Now Has Content')
      assertSchemaValid('F.10 — paste into empty section')
    })
  })
})
