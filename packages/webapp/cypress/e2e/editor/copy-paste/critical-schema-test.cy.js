/* eslint-disable no-undef */
/**
 * CRITICAL SCHEMA VALIDATION TEST
 *
 * This test specifically checks for the bug where pasted headings
 * become siblings of H1 instead of being nested inside H1's contentWrapper.
 *
 * HN-10 Rules:
 * - H1 is ONLY at document root (direct child of doc)
 * - H2-H10 MUST be nested inside a parent heading
 * - Child level MUST be > parent level
 */

import { section, paragraph } from '../../../fixtures/docMaker'

describe('CRITICAL: Schema Validation After External Paste', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  /**
   * Strict schema validator that checks for hierarchy violations
   */
  const strictValidateSchema = () => {
    return cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return { valid: false, errors: ['Editor not found'] }

      const doc = editor.state.doc
      const errors = []

      // Check 1: H1 should ONLY be direct children of document (depth 1)
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const $pos = doc.resolve(pos)
          const depth = $pos.depth

          // H1 at depth > 1 means it's nested inside something (WRONG!)
          if (level === 1 && depth > 1) {
            errors.push({
              type: 'H1_NESTED',
              message: `H1 found at depth ${depth} - should only be at depth 1 (document root)`,
              pos
            })
          }

          // H2+ at depth 1 means it's a sibling of H1 (WRONG!)
          if (level > 1 && depth === 1) {
            const title = node.firstChild?.textContent || 'Untitled'
            errors.push({
              type: 'H2_AT_ROOT',
              message: `H${level} "${title}" is at document root (depth 1) - should be nested inside H1`,
              pos
            })
          }
        }
      })

      // Check 2: Verify parent-child level relationships
      const headingStack = []
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const endPos = pos + node.nodeSize
          const title = node.firstChild?.textContent || 'Untitled'

          // Pop finished parents
          while (headingStack.length > 0) {
            const parent = headingStack[headingStack.length - 1]
            if (pos >= parent.endPos) headingStack.pop()
            else break
          }

          // Check against current parent
          if (headingStack.length > 0) {
            const parent = headingStack[headingStack.length - 1]
            if (level <= parent.level) {
              errors.push({
                type: 'INVALID_NESTING',
                message: `H${level} "${title}" inside H${parent.level} "${parent.title}" violates child > parent rule`,
                pos
              })
            }
          }

          headingStack.push({ pos, level, endPos, title })
        }
      })

      return {
        valid: errors.length === 0,
        errors,
        errorCount: errors.length
      }
    })
  }

  /**
   * Helper to paste HTML and strictly validate
   */
  const pasteHtmlAndValidate = (html) => {
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', html)
      clipboardData.setData('text/plain', html.replace(/<[^>]*>/g, ''))

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })

      editor.view.dom.dispatchEvent(pasteEvent)
    })
    cy.wait(500)

    // Log document structure for debugging
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const doc = editor.state.doc
      const structure = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const title = node.firstChild?.textContent || 'Untitled'
          const $pos = doc.resolve(pos)
          structure.push({
            level,
            title: title.substring(0, 30),
            pos,
            depth: $pos.depth,
            endPos: pos + node.nodeSize
          })
        }
      })

      cy.log('Document Structure:', JSON.stringify(structure, null, 2))
    })

    // Strict validation
    strictValidateSchema().then((result) => {
      if (!result.valid) {
        cy.log('❌ SCHEMA VIOLATIONS DETECTED:')
        result.errors.forEach((err, i) => {
          cy.log(`  ${i + 1}. [${err.type}] ${err.message}`)
        })
      }
      expect(result.valid, `Schema should be valid. Found ${result.errorCount} violations.`).to.be
        .true
    })
  }

  describe('H2 Must Be Nested Inside H1', () => {
    it('CRITICAL: Pasting H2 inside H1 contentWrapper should nest H2 inside H1', () => {
      cy.createDocument([section('Main Section', [paragraph('Click here to paste')])])
      cy.wait(500)

      // Click at end of paragraph inside H1's contentWrapper
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste H2
      pasteHtmlAndValidate('<h2>Pasted H2</h2><p>H2 content</p>')

      // Verify H2 exists and is nested
      cy.get('.docy_editor .heading[level="1"] .contentWrapper .heading[level="2"]')
        .should('exist')
        .and('contain', 'Pasted H2')
    })

    it('CRITICAL: Pasting H2 and H3 should create proper hierarchy', () => {
      cy.createDocument([section('Main Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtmlAndValidate('<h2>Chapter</h2><p>Intro</p><h3>Section</h3><p>Details</p>')

      // H2 should exist somewhere inside H1
      cy.get('.docy_editor .heading[level="1"] .contentWrapper .heading[level="2"]')
        .should('exist')
        .and('contain', 'Chapter')

      // H3 should exist somewhere inside H2
      cy.get('.docy_editor .heading[level="2"] .contentWrapper .heading[level="3"]')
        .should('exist')
        .and('contain', 'Section')
    })

    it('CRITICAL: Pasting external H1 should create new section at document root', () => {
      cy.createDocument([section('Existing Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste H1 - should become new section at root, not nested
      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const html = '<h1>New Section</h1><p>New content</p>'
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/html', html)

        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData,
          bubbles: true,
          cancelable: true
        })

        editor.view.dom.dispatchEvent(pasteEvent)
      })
      cy.wait(500)

      // Should have H1s (check without direct child selector since DOM has wrappers)
      cy.get('.docy_editor .heading[level="1"]').should('have.length.at.least', 1)

      // Validate no H1 is nested inside another heading
      strictValidateSchema().then((result) => {
        const h1NestedErrors = result.errors.filter((e) => e.type === 'H1_NESTED')
        expect(h1NestedErrors.length, 'No H1 should be nested').to.equal(0)
      })
    })
  })

  describe('DOM Structure Verification', () => {
    it('CRITICAL: H2 should be DOM child of H1 contentWrapper, not sibling', () => {
      cy.createDocument([section('Section', [paragraph('Para')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const html = '<h2>H2 Heading</h2><p>Content</p>'
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/html', html)

        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData,
          bubbles: true,
          cancelable: true
        })

        editor.view.dom.dispatchEvent(pasteEvent)
      })
      cy.wait(500)

      // DOM check: H2 should be INSIDE H1's contentWrapper
      cy.get('.docy_editor .heading[level="1"]').within(() => {
        cy.get('.contentWrapper .heading[level="2"]').should('exist')
      })

      // H2 should NOT be a direct child of .docy_editor (sibling of H1)
      cy.get('.docy_editor > .heading[level="2"]').should('not.exist')
    })
  })
})
