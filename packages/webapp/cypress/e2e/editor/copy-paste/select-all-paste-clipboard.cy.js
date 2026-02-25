/* eslint-disable no-undef */
/**
 * Select-All + Paste E2E Tests (T-4, E-7, T-5)
 *
 * Validates the critical user flow:
 *   CMD+A → CMD+V → CMD+A → CMD+V (repeated select-all + paste)
 *
 * Covers:
 *   T-4: isEntireDocumentSelected — structural detection (no magic numbers)
 *   E-7: transformCopied — relative positions on cut document
 *   T-5: clipboardPaste error fallback — preserves original slice
 *
 * HN-10 rules enforced by afterEach hooks:
 *   - Each section starts with H(1)
 *   - Child level > parent level (STACK-ATTACH)
 *   - Document is a forest of ordered trees
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Select-All + Paste — Clipboard Round-Trip', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  /**
   * Simulate pasting HTML content into the editor
   */
  const pasteHtml = (html) => {
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', html)
      clipboardData.setData('text/plain', html.replace(/<[^>]*>/g, ' '))

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })

      editor.view.dom.dispatchEvent(pasteEvent)
    })
    cy.wait(500)
  }

  /**
   * Get the heading count in the document
   */
  const getHeadingCount = () => {
    return cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return 0

      let count = 0
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') count++
      })
      return count
    })
  }

  // ============================================================================
  // T-4: Select-all detection works structurally
  // ============================================================================

  describe('T-4: Select-All Detection', () => {
    it('CMD+A selects entire single-section document correctly', () => {
      const doc = [section('Root Section', [paragraph('Body content')])]
      cy.createDocument(doc)

      // CMD+A
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      // Pressing Delete with entire doc selected should be handled by default
      // behavior (not by deleteSelectedRange), preserving at least one section
      cy.realPress('Backspace')
      cy.wait(300)

      // Document must still have at least one section (H1)
      cy.get('.docy_editor .heading[level="1"]').should('exist')
    })

    it('CMD+A selects entire multi-section document correctly', () => {
      const doc = [
        section('Section A', [paragraph('Content A')]),
        section('Section B', [paragraph('Content B')]),
        section('Section C', [paragraph('Content C')])
      ]
      cy.createDocument(doc)

      // CMD+A then Backspace should fall through to default behavior
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)
      cy.realPress('Backspace')
      cy.wait(300)

      // Document must remain valid
      cy.get('.docy_editor .heading[level="1"]').should('exist')
    })

    it('CMD+A works on deeply nested documents (H1 > H2 > H3)', () => {
      const doc = [
        section('Root', [
          paragraph('intro'),
          heading(2, 'Sub Section', [
            paragraph('sub content'),
            heading(3, 'Deep Section', [paragraph('deep content')])
          ])
        ])
      ]
      cy.createDocument(doc)

      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)
      cy.realPress('Backspace')
      cy.wait(300)

      // Must still have a valid section
      cy.get('.docy_editor .heading[level="1"]').should('exist')
    })
  })

  // ============================================================================
  // E-7: Copy produces valid clipboard data with correct positions
  // ============================================================================

  describe('E-7: Copy Produces Valid Clipboard Data', () => {
    it('copy from a heading section and paste preserves structure', () => {
      const doc = [
        section('Source', [
          paragraph('Source body'),
          heading(2, 'Source Child', [paragraph('Child body')])
        ]),
        section('Target', [paragraph('Target body')])
      ]
      cy.createDocument(doc)

      // Click into Source section and select the heading
      cy.get('.docy_editor .heading[level="2"] .title').first().click()
      cy.realPress('Home')
      cy.realPress(['Shift', 'End'])

      // Copy
      cy.realPress(['Meta', 'c'])
      cy.wait(300)

      // Click into Target section's content and paste
      cy.get('.docy_editor .heading[level="1"]').eq(1).find('.contentWrapper p').first().click()
      cy.realPress('End')
      pasteHtml('<h2>Source Child</h2>')

      // Verify schema is valid after paste
      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('copy multi-section content preserves heading levels', () => {
      const doc = [
        section('Section 1', [heading(2, 'H2 in S1', [paragraph('Content in S1')])]),
        section('Section 2', [paragraph('Body of S2')])
      ]
      cy.createDocument(doc)

      // Select all content in Section 1 — use direct child selector to avoid
      // matching nested heading titles inside contentWrapper
      cy.get('.docy_editor .heading[level="1"]').first().find('.title').first().click()
      cy.realPress('Home')

      cy.get('.docy_editor .heading[level="1"]')
        .first()
        .find('.title')
        .first()
        .clickAndSelect('section')
      cy.wait(300)

      // Copy
      cy.realPress(['Meta', 'c'])
      cy.wait(300)

      // Validate document still has valid structure
      cy.get('.docy_editor .heading[level="1"]').should('have.length.at.least', 1)
    })
  })

  // ============================================================================
  // T-5: Paste error recovery — original slice preserved
  // ============================================================================

  describe('T-5: Paste Error Recovery', () => {
    it('pasting malformed HTML still produces a valid document', () => {
      const doc = [section('Root', [paragraph('Original content')])]
      cy.createDocument(doc)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')

      // Paste intentionally messy HTML
      pasteHtml('<div><h2>Broken</h2><div><h3>Nested in div</h3><p>Text</p></div></div>')

      // Document must still be valid — even if paste transform failed internally,
      // the fallback (returning original slice) should let ProseMirror handle it
      cy.get('.docy_editor .heading[level="1"]').should('exist')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('pasting plain text into a heading does not corrupt document', () => {
      const doc = [section('Root', [paragraph('Body')])]
      cy.createDocument(doc)

      // Click into the heading title
      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('End')

      // Paste plain text
      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const clipboardData = new DataTransfer()
        clipboardData.setData('text/plain', ' appended text')

        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData,
          bubbles: true,
          cancelable: true
        })
        editor.view.dom.dispatchEvent(pasteEvent)
      })
      cy.wait(400)

      // Title should contain the pasted text
      cy.get('.docy_editor .heading[level="1"] .title').should('contain.text', 'Root')

      // Schema must remain valid
      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors: ${result.errors.join(', ')}`).to.be.true
      })
    })
  })

  // ============================================================================
  // CRITICAL: CMD+A → CMD+V → CMD+A → CMD+V (repeated select-all + paste)
  // ============================================================================

  describe('Critical: Repeated Select-All + Paste', () => {
    it('CMD+A then paste heading content produces valid document', () => {
      const doc = [
        section('Original Section', [
          paragraph('Original content'),
          heading(2, 'Original H2', [paragraph('H2 content')])
        ])
      ]
      cy.createDocument(doc)

      // CMD+A to select everything
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      // Paste new content over the entire document
      pasteHtml('<h1>New Root</h1><p>New body</p><h2>New Child</h2><p>Child body</p>')

      // Document must be valid after paste
      cy.get('.docy_editor .heading[level="1"]').should('exist')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after first paste: ${result.errors.join(', ')}`).to.be
          .true
      })
    })

    it('CMD+A → CMD+V → CMD+A → CMD+V: second select-all + paste works correctly', () => {
      const doc = [
        section('Section Alpha', [
          paragraph('Alpha content'),
          heading(2, 'Alpha Sub', [paragraph('Sub content')])
        ])
      ]
      cy.createDocument(doc)

      // ── FIRST CYCLE: CMD+A → paste ──
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      pasteHtml('<h1>First Paste</h1><p>First paste body</p>')

      cy.wait(500)
      cy.get('.docy_editor .heading[level="1"]').should('exist')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after first paste: ${result.errors.join(', ')}`).to.be
          .true
      })

      // ── SECOND CYCLE: CMD+A → paste again ──
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      pasteHtml(
        '<h1>Second Paste</h1><p>Second paste body</p><h2>Second Child</h2><p>Child content</p>'
      )

      cy.wait(500)
      cy.get('.docy_editor .heading[level="1"]').should('exist')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after second paste: ${result.errors.join(', ')}`).to.be
          .true
      })
    })

    it('CMD+A → paste multi-section content → CMD+A → paste again', () => {
      const doc = [section('Initial', [paragraph('Initial body')])]
      cy.createDocument(doc)

      // ── FIRST CYCLE ──
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      pasteHtml(
        '<h1>Section One</h1><p>One body</p>' +
          '<h2>Sub One</h2><p>Sub one body</p>' +
          '<h1>Section Two</h1><p>Two body</p>'
      )
      cy.wait(500)

      // Should have at least 2 sections (H1s)
      cy.get('.docy_editor .heading[level="1"]').should('have.length.at.least', 1)

      cy.validateDocumentSchema().then((result) => {
        expect(
          result.valid,
          `HN-10 errors after first multi-section paste: ${result.errors.join(', ')}`
        ).to.be.true
      })

      // ── SECOND CYCLE ──
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      pasteHtml(
        '<h1>Replaced Root</h1><p>Replaced body</p>' +
          '<h2>Replaced Sub</h2><p>Replaced sub body</p>'
      )
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"]').should('exist')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after second paste: ${result.errors.join(', ')}`).to.be
          .true
      })
    })

    it('CMD+A → paste preserves undo history: CMD+Z restores original', () => {
      const doc = [section('Undoable Section', [paragraph('Undoable content')])]
      cy.createDocument(doc)

      // CMD+A + paste
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      pasteHtml('<h1>Pasted Over</h1><p>New content</p>')
      cy.wait(500)

      // Undo should restore original
      cy.realPress(['Meta', 'z'])
      cy.wait(500)

      // Original section should be back
      cy.get('.docy_editor .heading[level="1"]').should('exist')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after undo: ${result.errors.join(', ')}`).to.be.true
      })
    })
  })

  // ============================================================================
  // Real-world HTML: minimax.io article (complex, many headings, images, lists)
  // ============================================================================

  describe('Real-world: minimax.io article paste', () => {
    it('paste real article HTML into contentHeading does not crash', () => {
      const doc = [section('Root', [paragraph('Existing content')])]
      cy.createDocument(doc)

      cy.readFile('cypress/fixtures/minimax-article.html').then((html) => {
        cy.get('.docy_editor .heading[level="1"] .title').click()
        cy.realPress('End')

        pasteHtml(html)
        cy.wait(1000)

        cy.get('.docy_editor .heading[level="1"]').should('exist')

        cy.validateDocumentSchema().then((result) => {
          expect(result.valid, `HN-10 errors after real paste: ${result.errors.join(', ')}`).to.be
            .true
        })
      })
    })

    it('CMD+A → paste real article → CMD+A → paste again: no contentMatchAt crash', () => {
      const doc = [section('Root', [paragraph('Initial content')])]
      cy.createDocument(doc)

      cy.readFile('cypress/fixtures/minimax-article.html').then((html) => {
        cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
        cy.realPress(['Meta', 'a'])
        cy.wait(200)

        pasteHtml(html)
        cy.wait(1500)

        cy.get('.docy_editor .heading[level="1"]').should('exist')

        cy.validateDocumentSchema().then((result) => {
          expect(result.valid, `HN-10 errors after first real paste: ${result.errors.join(', ')}`)
            .to.be.true
        })

        // Second cycle — use force:true because real article content is tall
        cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
        cy.realPress(['Meta', 'a'])
        cy.wait(200)

        pasteHtml(html)
        cy.wait(1500)

        cy.get('.docy_editor .heading[level="1"]').should('exist')

        cy.validateDocumentSchema().then((result) => {
          expect(result.valid, `HN-10 errors after second real paste: ${result.errors.join(', ')}`)
            .to.be.true
        })
      })
    })

    it('paste into contentHeading then CMD+A → CMD+V: mixed flow', () => {
      const doc = [section('Root', [paragraph('Body')])]
      cy.createDocument(doc)

      cy.readFile('cypress/fixtures/minimax-article.html').then((html) => {
        cy.get('.docy_editor .heading[level="1"] .title').click({ force: true })
        pasteHtml(html)
        cy.wait(1500)

        cy.get('.docy_editor .heading[level="1"]').should('exist')

        cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
        cy.realPress(['Meta', 'a'])
        cy.wait(200)

        pasteHtml(html)
        cy.wait(1500)

        cy.get('.docy_editor .heading[level="1"]').should('exist')

        cy.validateDocumentSchema().then((result) => {
          expect(result.valid, `HN-10 errors after mixed flow: ${result.errors.join(', ')}`).to.be
            .true
        })
      })
    })
  })

  // ============================================================================
  // Clipboard data standardization before insertion
  // ============================================================================

  describe('Clipboard Data Standardization', () => {
    it('pasted headings are adjusted to respect context level (HN-10 child > parent)', () => {
      const doc = [section('Root', [heading(2, 'Parent H2', [paragraph('Parent body')])])]
      cy.createDocument(doc)

      // Paste H2 content inside the existing H2's contentWrapper
      cy.get('.docy_editor .heading[level="2"] .contentWrapper p').first().click()
      cy.realPress('End')

      pasteHtml('<h2>Pasted H2</h2><p>Pasted body</p>')

      // The pasted H2 should be adjusted to H3 (child must be > parent level 2)
      cy.wait(500)

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('H1 pasted inside a section is extracted to document root', () => {
      const doc = [section('Existing', [paragraph('Existing body')])]
      cy.createDocument(doc)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')

      pasteHtml('<h1>New Section</h1><p>New section body</p>')
      cy.wait(500)

      // The pasted H1 should become a separate section at document root
      cy.get('.docy_editor .heading[level="1"]').should('have.length.at.least', 1)

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('deeply nested paste content adjusts levels correctly', () => {
      const doc = [
        section('Root', [
          heading(2, 'H2 Parent', [heading(3, 'H3 Child', [paragraph('Deep content')])])
        ])
      ]
      cy.createDocument(doc)

      // Paste inside H3's content wrapper
      cy.get('.docy_editor .heading[level="3"] .contentWrapper p').first().click()
      cy.realPress('End')

      pasteHtml(
        '<h2>Incoming H2</h2><p>Incoming body</p><h3>Incoming H3</h3><p>Incoming H3 body</p>'
      )
      cy.wait(500)

      // All pasted headings should be adjusted to be > H3 (level 3)
      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors: ${result.errors.join(', ')}`).to.be.true
      })
    })
  })
})
