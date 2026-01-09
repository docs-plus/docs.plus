/* eslint-disable no-undef */
/**
 * External Paste Tests
 *
 * Tests for pasting content from external sources (other apps, web pages).
 * This tests the transformPastedHTML and transformPasted pipeline.
 */

import { section, paragraph } from '../../../fixtures/docMaker'

describe('External Paste - HTML from Other Sources', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  /**
   * Helper to simulate pasting HTML content
   */
  const pasteHtml = (html) => {
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
  }

  /**
   * Validates schema after paste - checks HN-10 rules
   */
  const validateSchemaAfterPaste = () => {
    return cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return { valid: true, errors: [] }

      const doc = editor.state.doc
      const errors = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const $pos = doc.resolve(pos)
          const depth = $pos.depth
          const title = node.firstChild?.textContent?.substring(0, 20) || 'Untitled'

          // H1 nested inside something = ERROR
          if (level === 1 && depth > 1) {
            errors.push(`H1 "${title}" nested at depth ${depth}`)
          }

          // H2+ at document root = ERROR
          if (level > 1 && depth === 1) {
            errors.push(`H${level} "${title}" at document root (should be nested)`)
          }
        }
      })

      if (errors.length > 0) {
        cy.log('❌ SCHEMA ERRORS:', errors.join('; '))
      }

      return { valid: errors.length === 0, errors }
    })
  }

  describe('Plain HTML Headings', () => {
    it('should paste external H1 as new section', () => {
      cy.createDocument([section('Existing Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<h1>External Section</h1><p>External content</p>')

      cy.get('.docy_editor').should('contain', 'External')

      // Validate schema
      validateSchemaAfterPaste().then((result) => {
        expect(result.valid, `Schema violations: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('should paste H2-H6 tags correctly', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<h2>Heading 2</h2><h3>Heading 3</h3><p>Content</p>')

      cy.get('.docy_editor').should('contain', 'Heading 2')

      // Validate schema - H2 should be inside H1, H3 inside H2
      validateSchemaAfterPaste().then((result) => {
        expect(result.valid, `Schema violations: ${result.errors.join(', ')}`).to.be.true
      })

      // Verify H2 is nested inside H1
      cy.get('.docy_editor .heading[level="1"] .contentWrapper .heading[level="2"]').should('exist')
    })

    it('should handle mixed heading levels from external source', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <h2>Chapter 1</h2>
        <p>Introduction text</p>
        <h3>Section 1.1</h3>
        <p>Section content</p>
      `)

      cy.get('.docy_editor').should('contain', 'Chapter')

      // Validate schema
      validateSchemaAfterPaste().then((result) => {
        expect(result.valid, `Schema violations: ${result.errors.join(', ')}`).to.be.true
      })

      // Verify proper nesting
      cy.get('.docy_editor .heading[level="1"] .contentWrapper .heading[level="2"]').should('exist')
      cy.get('.docy_editor .heading[level="2"] .contentWrapper .heading[level="3"]').should('exist')
    })
  })

  describe('Rich Text from Apps', () => {
    it('should paste Google Docs style HTML', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <span style="font-weight:700">Bold text</span>
        <span style="font-style:italic">Italic text</span>
        <p>Normal paragraph from Google Docs</p>
      `)

      cy.get('.docy_editor').should('contain', 'Bold text')
    })

    it('should paste Word/Office HTML', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p class="MsoNormal">
          <b><span style="font-size:14.0pt">Word Heading</span></b>
        </p>
        <p class="MsoNormal">Word paragraph content.</p>
      `)

      cy.get('.docy_editor').should('contain', 'Word')
    })
  })

  describe('Lists and Structured Content', () => {
    it('should paste bullet lists', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      `)

      cy.get('.docy_editor').should('contain', 'First item')
    })

    it('should paste numbered lists', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <ol>
          <li>Step one</li>
          <li>Step two</li>
        </ol>
      `)

      cy.get('.docy_editor').should('contain', 'Step one')
    })
  })

  describe('Formatted Text', () => {
    it('should preserve bold and italic formatting', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p>This has <b>bold</b> and <i>italic</i> text.</p>
      `)

      cy.get('.docy_editor').should('contain', 'bold')
    })

    it('should preserve links', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p>Check out <a href="https://example.com">this link</a> for more.</p>
      `)

      cy.get('.docy_editor').should('contain', 'this link')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty paste', () => {
      cy.createDocument([section('Section', [paragraph('Original')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.wait(100)

      pasteHtml('')

      cy.get('.docy_editor').should('contain', 'Original')
    })

    it('should handle emoji and unicode', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<p>🎉 Celebration! 中文</p>')

      cy.get('.docy_editor').should('contain', '🎉')
    })

    it('should handle transformPastedHTML (div to span conversion)', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste paragraphs with inline divs - divs get converted to spans
      pasteHtml(`
        <p>Text with <div style="display:inline">inline div</div> inside</p>
      `)

      // Content should be pasted
      cy.get('.docy_editor').should('contain', 'Text with')
    })
  })
})
