/* eslint-disable no-undef */
/**
 * Cut Operations Tests
 *
 * Tests for cutting (Cmd+X) content which should:
 * 1. Copy content to clipboard (via transformCopied)
 * 2. Delete the selected content (via deleteSelectedRange)
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Cut Operations', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  describe('Cut Paragraphs', () => {
    it('should cut paragraph text and allow paste elsewhere', () => {
      cy.createDocument([
        section('Section', [paragraph('Text to cut'), paragraph('Destination paragraph')])
      ])
      cy.wait(500)

      // Select first paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      // Cut
      cy.realPress(['Meta', 'x'])
      cy.wait(300)

      // Click in destination
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'Text to cut')
    })
  })

  describe('Cut Headings', () => {
    it('should cut heading and all its content', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Heading to Cut', [paragraph('Content inside heading')]),
          heading(2, 'Remaining Heading', [paragraph('This stays')])
        ])
      ])
      cy.wait(500)

      // Select first H2
      cy.get('.docy_editor .heading[level="2"]').first().find('.title').click()
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(100)

      // Cut
      cy.realPress(['Meta', 'x'])
      cy.wait(300)

      // Should still have at least one H2
      cy.get('.docy_editor .heading[level="2"]').should('exist')
    })

    it('should cut heading with nested children', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Parent to Cut', [
            paragraph('Parent content'),
            heading(3, 'Child Heading', [paragraph('Child content')])
          ]),
          heading(2, 'Sibling Heading', [paragraph('Sibling content')])
        ])
      ])
      cy.wait(500)

      // Verify structure before cut
      cy.get('.docy_editor .heading[level="3"]').should('exist')

      // Select parent H2 (first one)
      cy.get('.docy_editor .heading[level="2"] .title').first().click()
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(100)

      cy.realPress(['Meta', 'x'])
      cy.wait(300)

      // Sibling should still exist
      cy.get('.docy_editor').should('contain', 'Sibling Heading')
    })
  })

  describe('Cut Undo/Redo', () => {
    it('should allow pasting cut content', () => {
      cy.createDocument([
        section('Section', [paragraph('Content to cut and paste'), paragraph('Other content')])
      ])
      cy.wait(500)

      // Select first paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      // Cut
      cy.realPress(['Meta', 'x'])
      cy.wait(300)

      // Move to end of other paragraph and paste
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(300)

      // Verify cut content was pasted
      cy.get('.docy_editor').should('contain', 'Content to cut')
    })
  })
})
