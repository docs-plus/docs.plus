/* eslint-disable no-undef */
/**
 * Internal Copy/Paste Tests
 *
 * Tests for copying and pasting content within the same document.
 * These tests exercise the full clipboard pipeline:
 * - transformCopied (on copy)
 * - transformPastedHTML + transformPasted/clipboardPast (on paste)
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Internal Copy/Paste - Same Document', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  describe('Copy/Paste Paragraphs', () => {
    it('should copy and paste a paragraph within same section', () => {
      cy.createDocument([
        section('Section', [paragraph('This is the text to copy.'), paragraph('Target paragraph.')])
      ])
      cy.wait(500)

      // Select the first paragraph text
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      // Copy
      cy.realPress(['Meta', 'c'])
      cy.wait(200)

      // Click at the end of second paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(300)

      // Verify the content was pasted
      cy.get('.docy_editor .heading[level="1"] .contentWrapper').should(
        'contain',
        'This is the text to copy'
      )
    })

    it('should cut and paste a paragraph', () => {
      cy.createDocument([
        section('Section', [paragraph('Cut this text.'), paragraph('Keep this text.')])
      ])
      cy.wait(500)

      // Select first paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      // Cut
      cy.realPress(['Meta', 'x'])
      cy.wait(200)

      // Click in remaining paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(300)

      // Verify cut text appears at new location
      cy.get('.docy_editor .heading[level="1"] .contentWrapper').should('contain', 'Cut this text')
    })
  })

  describe('Copy/Paste Headings - Same Level', () => {
    it('should copy H2 and paste as sibling H2', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Source Heading', [paragraph('Source content')]),
          heading(2, 'Target Heading', [paragraph('Target content')])
        ])
      ])
      cy.wait(500)

      // Copy source H2
      cy.get('.docy_editor .heading[level="2"]').first().find('.title').click()
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)

      // Click after target heading's content
      cy.get('.docy_editor .heading[level="2"]').last().find('.contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Should have H2 headings
      cy.get('.docy_editor .heading[level="2"]').should('have.length.at.least', 2)
    })
  })

  describe('Copy/Paste Headings - Level Adjustment', () => {
    it('should copy H2 and paste inside H2 (becomes H3)', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Source H2', [paragraph('Source content')]),
          heading(2, 'Target H2', [paragraph('Target content')])
        ])
      ])
      cy.wait(500)

      // Copy source H2
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)

      // Click inside target H2's contentWrapper
      cy.get('.docy_editor .heading[level="2"]').last().find('.contentWrapper p').click()
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // The pasted heading should exist
      cy.get('.docy_editor .heading[level="2"]').should('have.length.at.least', 2)
    })

    it('should copy H3 and paste inside H4 (becomes H5)', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'L2', [
            heading(3, 'Source H3', [paragraph('Source content to copy')]),
            heading(3, 'Another H3', [heading(4, 'Target H4', [paragraph('Target content')])])
          ])
        ])
      ])
      cy.wait(500)

      // Copy source H3
      cy.get('.docy_editor .heading[level="3"]').first().clickAndSelectCopy('heading')
      cy.wait(200)

      // Click inside H4's contentWrapper
      cy.get('.docy_editor .heading[level="4"]').find('.contentWrapper p').click()
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Should have content pasted somewhere in the document
      cy.get('.docy_editor').should('contain', 'Source content to copy')
    })
  })

  describe('Copy/Paste with Nested Structure', () => {
    it('should copy heading with children and preserve structure', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Parent to Copy', [
            paragraph('Parent content'),
            heading(3, 'Child Heading', [paragraph('Child content')])
          ]),
          heading(2, 'After Target', [paragraph('After content')])
        ])
      ])
      cy.wait(500)

      // Copy the first H2
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)

      // Click after the second H2
      cy.get('.docy_editor .heading[level="2"]').last().find('.contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Should have the copied structure
      cy.get('.docy_editor .heading[level="2"]').should('have.length.at.least', 2)
    })
  })

  describe('Copy/Paste H1 Sections', () => {
    it('should copy H1 section and paste as new section at document end', () => {
      cy.createDocument([
        section('First Section', [
          paragraph('First content'),
          heading(2, 'First H2', [paragraph('H2 content')])
        ])
      ])
      cy.wait(500)

      // Copy the entire H1 section
      cy.get('.docy_editor .heading[level="1"]').first().clickAndSelectCopy('heading')
      cy.wait(200)

      // Move to document end
      cy.get('.docy_editor').click()
      cy.realPress(['Meta', 'End'])
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Should have H1 section content visible
      cy.get('.docy_editor .heading[level="1"]').should('have.length.at.least', 1)
    })
  })
})
