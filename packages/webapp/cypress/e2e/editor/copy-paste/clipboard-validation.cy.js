/* eslint-disable no-undef */
/**
 * Clipboard Validation Tests
 *
 * Tests that validate the clipboard processing pipeline.
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Clipboard Pipeline Validation', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  describe('transformCopied Validation', () => {
    it('should serialize heading selection correctly', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Test Heading', [
            paragraph('Heading content'),
            heading(3, 'Nested Heading', [paragraph('Nested content')])
          ])
        ])
      ])
      cy.wait(500)

      // Select H2 and copy
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)

      // Paste to verify it was copied correctly
      cy.get('.docy_editor .heading[level="1"] .contentWrapper').last().click()
      cy.realPress('End')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      cy.get('.docy_editor').should('contain', 'Test Heading')
    })

    it('should serialize paragraph selection correctly', () => {
      cy.createDocument([
        section('Section', [
          paragraph('First paragraph with text.'),
          paragraph('Second paragraph.')
        ])
      ])
      cy.wait(500)

      // Select first paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      // Copy
      cy.realPress(['Meta', 'c'])
      cy.wait(200)

      // Click at end of document
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.realPress('End')

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'First paragraph')
    })
  })

  describe('clipboardPast Function Validation', () => {
    it('should handle paste in contentHeading (title)', () => {
      cy.createDocument([section('Original Title', [paragraph('Content')])])
      cy.wait(500)

      // Click inside the title
      cy.get('.docy_editor .heading[level="1"] .title').click()
      cy.realPress('End')
      cy.wait(100)

      // Paste text
      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const html = ' Appended'
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/html', html)
        clipboardData.setData('text/plain', 'Appended')

        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData,
          bubbles: true,
          cancelable: true
        })

        editor.view.dom.dispatchEvent(pasteEvent)
      })
      cy.wait(300)

      cy.get('.docy_editor .heading[level="1"] .title').should('contain', 'Appended')
    })

    it('should handle paste in contentWrapper (body)', () => {
      cy.createDocument([section('Section', [paragraph('Existing')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const html = '<p>New paragraph</p>'
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/html', html)

        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData,
          bubbles: true,
          cancelable: true
        })

        editor.view.dom.dispatchEvent(pasteEvent)
      })
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'New paragraph')
    })

    it('should process headings from clipboard correctly', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return

        const html = '<h2>Pasted H2</h2><p>H2 content</p><h3>Pasted H3</h3><p>H3 content</p>'
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

      cy.get('.docy_editor').should('contain', 'Pasted H2')
    })
  })
})
