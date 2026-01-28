/* eslint-disable no-undef */
/**
 * Schema Validation After Paste Tests
 *
 * These tests verify that:
 * 1. Pasted content is correctly inserted
 * 2. The resulting document follows HN-10 schema rules
 * 3. No hierarchy violations exist after paste
 *
 * HN-10 Rules:
 * - H1 cannot be nested inside any heading
 * - Child level must be > parent level
 * - Levels range from 1-10
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Schema Validation After Paste', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  /**
   * Validates the document follows HN-10 schema rules
   */
  const validateSchema = () => {
    return cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return { valid: false, errors: ['Editor not found'] }

      const doc = editor.state.doc
      const errors = []
      const headingStack = []

      // Walk through the document and check hierarchy
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || node.attrs?.level || 1
          const endPos = pos + node.nodeSize
          const title = node.firstChild?.textContent || 'Untitled'

          // Check if we're still inside parent headings
          while (headingStack.length > 0) {
            const parent = headingStack[headingStack.length - 1]
            if (pos >= parent.endPos) {
              headingStack.pop()
            } else {
              break
            }
          }

          // Validate against parent
          if (headingStack.length > 0) {
            const parent = headingStack[headingStack.length - 1]

            // Rule: H1 cannot be nested
            if (level === 1) {
              errors.push({
                type: 'H1_NESTED',
                message: `H1 "${title}" is nested inside H${parent.level} "${parent.title}"`,
                pos,
                parentPos: parent.pos
              })
            }

            // Rule: Child level must be > parent level
            if (level <= parent.level) {
              errors.push({
                type: 'INVALID_CHILD_LEVEL',
                message: `H${level} "${title}" nested inside H${parent.level} "${parent.title}" violates child > parent rule`,
                pos,
                parentPos: parent.pos
              })
            }
          }

          headingStack.push({ pos, level, endPos, title })
        }
      })

      return {
        valid: errors.length === 0,
        errors
      }
    })
  }

  /**
   * Helper to paste HTML and validate schema
   */
  const pasteAndValidate = (html, expectedValid = true) => {
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

    // Validate schema after paste
    validateSchema().then((result) => {
      if (expectedValid) {
        if (!result.valid) {
          cy.log('Schema Errors:', JSON.stringify(result.errors, null, 2))
        }
        expect(result.valid, 'Schema should be valid after paste').to.be.true
      } else {
        // If we expect invalid, log what we found
        cy.log('Expected invalid schema, found:', JSON.stringify(result.errors, null, 2))
      }
    })
  }

  describe('Basic Paste Schema Validation', () => {
    it('should maintain valid schema after pasting paragraph', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate('<p>Pasted paragraph</p>', true)

      cy.get('.docy_editor').should('contain', 'Pasted paragraph')
    })

    it('should maintain valid schema after pasting H2 at root level', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate('<h2>New H2</h2><p>H2 content</p>', true)

      cy.get('.docy_editor').should('contain', 'New H2')
    })

    it('should maintain valid schema after pasting H3 inside H2', () => {
      cy.createDocument([
        section('Section', [heading(2, 'Existing H2', [paragraph('H2 content')])])
      ])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="2"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate('<h3>Nested H3</h3><p>H3 content</p>', true)

      cy.get('.docy_editor').should('contain', 'Nested H3')
    })
  })

  describe('Paste at ContentWrapper Boundaries', () => {
    it('should validate schema when pasting at START of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('First para'), paragraph('Second para')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('Home')
      cy.wait(100)

      pasteAndValidate('<h2>Prepended H2</h2><p>Content</p>', true)

      cy.get('.docy_editor').should('contain', 'Prepended H2')
    })

    it('should validate schema when pasting at END of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('Content before')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate('<h2>Appended H2</h2><p>Content</p>', true)

      cy.get('.docy_editor').should('contain', 'Appended H2')
    })

    it('should validate schema when pasting at end of nested heading contentWrapper', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Parent H2', [
            paragraph('Parent content'),
            heading(3, 'Child H3', [paragraph('Child content')])
          ])
        ])
      ])
      cy.wait(500)

      // Paste at end of H2's contentWrapper (after H3)
      cy.get('.docy_editor .heading[level="3"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate('<h4>New H4</h4><p>H4 content</p>', true)

      cy.get('.docy_editor').should('contain', 'New H4')
    })
  })

  describe('Level Adjustment Validation', () => {
    it('should adjust levels and maintain valid schema when pasting H2 inside H3', () => {
      cy.createDocument([
        section('Section', [heading(2, 'L2', [heading(3, 'L3', [paragraph('L3 content')])])])
      ])
      cy.wait(500)

      // Paste H2 inside H3 - should be adjusted to H4
      cy.get('.docy_editor .heading[level="3"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate('<h2>Should become H4</h2><p>Content</p>', true)

      // Verify content exists
      cy.get('.docy_editor').should('contain', 'Should become H4')
    })

    it('should handle pasting at level 9 without exceeding 10', () => {
      // Create deep nesting
      cy.createDocument([
        section('Section', [
          heading(2, 'L2', [
            heading(3, 'L3', [
              heading(4, 'L4', [
                heading(5, 'L5', [
                  heading(6, 'L6', [
                    heading(7, 'L7', [heading(8, 'L8', [heading(9, 'L9', [paragraph('Deep')])])])
                  ])
                ])
              ])
            ])
          ])
        ])
      ])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="9"] .contentWrapper p').first().click()
      cy.wait(100)

      // Paste inside L9 - should become L10 (max)
      pasteAndValidate('<h2>Should be H10</h2><p>Deepest</p>', true)

      // Check no level 11 exists
      cy.get('.docy_editor .heading[level="11"]').should('not.exist')
    })
  })

  describe('H1 Special Cases', () => {
    it('should extract H1 to document root when pasted inside section', () => {
      cy.createDocument([section('First Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste H1 - should be extracted to document root
      pasteAndValidate('<h1>New Section</h1><p>New section content</p>', true)

      // Should have the new section content
      cy.get('.docy_editor').should('contain', 'New Section')
    })
  })

  describe('Complex Structure Validation', () => {
    it('should validate schema after pasting multi-level hierarchy', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate(
        `
        <h2>Chapter 1</h2>
        <p>Chapter intro</p>
        <h3>Section 1.1</h3>
        <p>Section content</p>
        <h4>Subsection 1.1.1</h4>
        <p>Details</p>
        <h3>Section 1.2</h3>
        <p>More content</p>
      `,
        true
      )

      cy.get('.docy_editor').should('contain', 'Chapter 1')
      cy.get('.docy_editor').should('contain', 'Section 1.1')
      cy.get('.docy_editor').should('contain', 'Subsection 1.1.1')
    })

    it('should validate after pasting between sibling headings', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'First H2', [paragraph('First content')]),
          heading(2, 'Second H2', [paragraph('Second content')])
        ])
      ])
      cy.wait(500)

      // Click in first H2's content
      cy.get('.docy_editor .heading[level="2"]').first().find('.contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      pasteAndValidate('<p>Inserted between siblings</p>', true)

      cy.get('.docy_editor').should('contain', 'Inserted between siblings')
    })
  })

  describe('Debug: Log Schema State', () => {
    it('should log document structure after paste for debugging', () => {
      cy.createDocument([section('Section', [heading(2, 'Existing H2', [paragraph('Content')])])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="2"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste something
      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const html = '<h3>Debug H3</h3><p>Debug content</p>'
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

      // Log the document structure
      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const doc = editor.state.doc
        const structure = []

        doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            const level = node.firstChild?.attrs?.level || 1
            const title = node.firstChild?.textContent || 'Untitled'
            const depth = doc.resolve(pos).depth
            structure.push({
              level,
              title,
              pos,
              depth,
              endPos: pos + node.nodeSize
            })
          }
        })

        cy.log('Document Structure After Paste:')
        cy.log(JSON.stringify(structure, null, 2))
      })

      cy.get('.docy_editor').should('contain', 'Debug H3')
    })
  })
})
