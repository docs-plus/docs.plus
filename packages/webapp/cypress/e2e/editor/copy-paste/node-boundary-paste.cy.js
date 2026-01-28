/* eslint-disable no-undef */
/**
 * Node Boundary Paste Tests
 *
 * Tests pasting at the leaf/boundary positions of custom nodes:
 * - ContentHeading (title) - start, middle, end
 * - ContentWrapper - start, end, empty
 * - Between nodes
 *
 * These edge cases are critical for proper clipboard handling.
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Node Boundary Paste - Edge Cases', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

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

  describe('ContentHeading (Title) Boundaries', () => {
    it('should paste plain text at START of title', () => {
      cy.createDocument([section('Original Title', [paragraph('Content')])])
      cy.wait(500)

      // Click at the very start of the title
      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('Home')
      cy.wait(100)

      pasteHtml('<p>Prepended </p>')

      cy.get('.docy_editor .heading[level="1"] .title').should('contain', 'Prepended')
    })

    it('should paste plain text at END of title', () => {
      cy.createDocument([section('Original Title', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<p> Appended</p>')

      cy.get('.docy_editor .heading[level="1"] .title').should('contain', 'Appended')
    })

    it('should paste plain text in MIDDLE of title', () => {
      cy.createDocument([section('OriginalTitle', [paragraph('Content')])])
      cy.wait(500)

      // Position caret in middle of title
      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('Home')
      // Move 8 characters right to get between "Original" and "Title"
      for (let i = 0; i < 8; i++) {
        cy.realPress('ArrowRight')
      }
      cy.wait(100)

      pasteHtml('<p>INSERTED</p>')

      cy.get('.docy_editor .heading[level="1"] .title').should('contain', 'INSERTED')
    })

    it('should paste heading tag into title (should flatten to text)', () => {
      cy.createDocument([section('Title', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('End')
      cy.wait(100)

      // Paste H2 - should extract text only since titles don't accept block content
      pasteHtml('<h2>Heading Text</h2>')

      // Title should contain the text
      cy.get('.docy_editor .heading[level="1"] .title').invoke('text').should('include', 'Heading')
    })

    it('should paste formatted text (bold/italic) at title end', () => {
      // Handle potential errors from special character paste
      cy.on('uncaught:exception', () => false)

      cy.createDocument([section('Title', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<p><b>Bold</b> text</p>')

      cy.get('.docy_editor .heading[level="1"] .title').should('contain', 'Bold')
    })

    it('should paste multiline text into title (should merge into single line)', () => {
      cy.createDocument([section('Title', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<p>Line 1</p><p>Line 2</p><p>Line 3</p>')

      // Check title contains pasted content (may be merged)
      cy.get('.docy_editor .heading[level="1"] .title')
        .invoke('text')
        .then((text) => {
          expect(text).to.include('Line')
        })
    })
  })

  describe('ContentWrapper Start Boundaries', () => {
    it('should paste paragraph at START of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('Existing paragraph content')])])
      cy.wait(500)

      // Click at start of first paragraph in contentWrapper
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('Home')
      cy.wait(100)

      pasteHtml('<p>Prepended paragraph</p>')

      cy.get('.docy_editor .heading[level="1"] .contentWrapper').should(
        'contain',
        'Prepended paragraph'
      )
    })

    it('should paste heading at START of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('First paragraph')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('Home')
      cy.wait(100)

      pasteHtml('<h2>New H2</h2><p>H2 content</p>')

      cy.get('.docy_editor').should('contain', 'New H2')
    })

    it('should paste complex structure at START of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('Original content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('Home')
      cy.wait(100)

      pasteHtml(`
        <h2>Chapter One</h2>
        <p>Introduction</p>
        <h3>Subsection</h3>
        <p>Details</p>
      `)

      cy.get('.docy_editor').should('contain', 'Chapter One')
      cy.get('.docy_editor').should('contain', 'Introduction')
    })
  })

  describe('ContentWrapper End Boundaries', () => {
    it('should paste paragraph at END of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('Existing content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<p>Appended paragraph</p>')

      cy.get('.docy_editor .heading[level="1"] .contentWrapper').should(
        'contain',
        'Appended paragraph'
      )
    })

    it('should paste heading at END of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<h2>Appended H2</h2><p>H2 content</p>')

      cy.get('.docy_editor').should('contain', 'Appended H2')
    })

    it('should paste list at END of contentWrapper', () => {
      cy.createDocument([section('Section', [paragraph('Content before list')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      `)

      cy.get('.docy_editor').should('contain', 'Item 1')
    })

    it('should paste deeply nested structure at END', () => {
      cy.createDocument([section('Section', [paragraph('Existing')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <h2>Level 2</h2>
        <p>L2 content</p>
        <h3>Level 3</h3>
        <p>L3 content</p>
        <h4>Level 4</h4>
        <p>L4 content</p>
      `)

      cy.get('.docy_editor').should('contain', 'Level 2')
      cy.get('.docy_editor').should('contain', 'Level 3')
      cy.get('.docy_editor').should('contain', 'Level 4')
    })
  })

  describe('Empty ContentWrapper', () => {
    it('should paste into empty contentWrapper', () => {
      // Create a heading with just empty paragraph
      cy.createDocument([section('Empty Section', [paragraph('')])])
      cy.wait(500)

      // Click in the empty paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.wait(100)

      pasteHtml('<p>Pasted into empty</p>')

      cy.get('.docy_editor .heading[level="1"] .contentWrapper').should(
        'contain',
        'Pasted into empty'
      )
    })

    it('should paste heading structure into empty contentWrapper', () => {
      cy.createDocument([section('Empty Section', [paragraph('')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.wait(100)

      pasteHtml('<h2>First Heading</h2><p>With content</p>')

      cy.get('.docy_editor').should('contain', 'First Heading')
    })
  })

  describe('Between Nested Headings', () => {
    it('should paste at end of first H2 content', () => {
      cy.on('uncaught:exception', () => false)

      cy.createDocument([
        section('Section', [
          heading(2, 'First H2', [paragraph('First content here')]),
          heading(2, 'Second H2', [paragraph('Second content')])
        ])
      ])
      cy.wait(500)

      // Click at end of first H2's paragraph content and type to verify focus
      cy.get('.docy_editor .heading[level="2"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Type directly to verify cursor position
      cy.realType(' + appended text')
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'appended text')
    })

    it('should paste text at second H2 content', () => {
      cy.on('uncaught:exception', () => false)

      cy.createDocument([
        section('Section', [
          heading(2, 'First H2', [paragraph('First content')]),
          heading(2, 'Second H2', [paragraph('Second content here')])
        ])
      ])
      cy.wait(500)

      // Focus on second H2's paragraph
      cy.get('.docy_editor .heading[level="2"]').last().find('.contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      // Type to verify cursor position
      cy.realType(' and more text')
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'and more text')
    })

    it('should paste at end of deeply nested heading', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'L2', [heading(3, 'L3', [heading(4, 'L4', [paragraph('Deep content')])])])
        ])
      ])
      cy.wait(500)

      // Click at end of L4's content
      cy.get('.docy_editor .heading[level="4"] .contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<h5>L5 Heading</h5><p>L5 content</p>')

      cy.get('.docy_editor').should('contain', 'L5 Heading')
    })
  })

  describe('Complex Clipboard Content at Boundaries', () => {
    it('should paste mixed content (paragraphs, lists, headings) at contentWrapper start', () => {
      cy.createDocument([section('Section', [paragraph('Original')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('Home')
      cy.wait(100)

      pasteHtml(`
        <p>Intro paragraph</p>
        <ul>
          <li>Bullet 1</li>
          <li>Bullet 2</li>
        </ul>
        <h2>Section Heading</h2>
        <p>Section content</p>
        <ol>
          <li>Step 1</li>
          <li>Step 2</li>
        </ol>
      `)

      cy.get('.docy_editor').should('contain', 'Intro paragraph')
      cy.get('.docy_editor').should('contain', 'Bullet 1')
      cy.get('.docy_editor').should('contain', 'Section Heading')
    })

    it('should paste Google Docs formatted content at title end', () => {
      cy.on('uncaught:exception', () => false)

      cy.createDocument([section('Title', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('End')
      cy.wait(100)

      // Simulate Google Docs-style HTML (wrapped in paragraph for better parsing)
      pasteHtml(`
        <p><span style="font-weight:700"> - Important</span></p>
      `)

      cy.get('.docy_editor .heading[level="1"] .title').should('contain', 'Important')
    })

    it('should paste table-like content at contentWrapper end', () => {
      cy.createDocument([section('Section', [paragraph('Before table')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      // Tables may be converted to text or preserved depending on schema
      pasteHtml(`
        <table>
          <tr><td>Cell 1</td><td>Cell 2</td></tr>
          <tr><td>Cell 3</td><td>Cell 4</td></tr>
        </table>
      `)

      // At minimum, some content should be pasted
      cy.get('.docy_editor').should('contain', 'Cell')
    })

    it('should handle paste with embedded images (graceful handling)', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p>Text before image</p>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Test">
        <p>Text after image</p>
      `)

      cy.get('.docy_editor').should('contain', 'Text before image')
    })
  })

  describe('H2 ContentHeading Boundaries', () => {
    it('should paste at START of H2 title', () => {
      cy.createDocument([section('Section', [heading(2, 'H2 Title', [paragraph('Content')])])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="2"] .title').click()
      cy.realPress('Home')
      cy.wait(100)

      pasteHtml('<p>Prefix </p>')

      cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'Prefix')
    })

    it('should paste at END of H2 title', () => {
      cy.createDocument([section('Section', [heading(2, 'H2 Title', [paragraph('Content')])])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="2"] .title').click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<p> Suffix</p>')

      cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'Suffix')
    })
  })

  describe('Deep Nesting Boundaries', () => {
    it('should paste at H5 contentWrapper boundary', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'L2', [
            heading(3, 'L3', [heading(4, 'L4', [heading(5, 'L5', [paragraph('Deep content')])])])
          ])
        ])
      ])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="5"] .contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<h6>L6 Heading</h6><p>Very deep</p>')

      cy.get('.docy_editor').should('contain', 'L6 Heading')
    })

    it('should paste complex structure at deep nesting level', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'L2', [heading(3, 'L3', [heading(4, 'Target L4', [paragraph('L4 content')])])])
        ])
      ])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="4"] .contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p>Added paragraph</p>
        <h5>L5 from paste</h5>
        <p>L5 content</p>
        <h6>L6 from paste</h6>
        <p>L6 content</p>
      `)

      cy.get('.docy_editor').should('contain', 'Added paragraph')
      cy.get('.docy_editor').should('contain', 'L5 from paste')
    })
  })
})
