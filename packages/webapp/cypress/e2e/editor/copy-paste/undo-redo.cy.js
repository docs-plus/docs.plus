/* eslint-disable no-undef */
/**
 * Undo/Redo Tests (I1-I4)
 *
 * Tests that undo/redo operations work correctly
 * with copy/paste transactions.
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Copy/Paste - Undo/Redo', () => {
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
      clipboardData.setData('text/plain', html.replace(/<[^>]*>/g, ' '))

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })

      editor.view.dom.dispatchEvent(pasteEvent)
    })
    cy.wait(400)
  }

  // ============================================================================
  // I1: Undo after paste - original state restored
  // ============================================================================
  it('I1: Undo after paste should restore original state', () => {
    const doc = [section('Section', [paragraph('Original content')])]
    cy.createDocument(doc)

    // Paste heading content
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.realPress('End')
    pasteHtml('<h2>New Heading</h2><p>New content</p>')

    // Verify paste happened
    cy.get('.docy_editor .heading[level="2"]').should('exist')

    // Undo
    cy.realPress(['Meta', 'z'])
    cy.wait(400)

    // Pasted heading should be removed
    cy.get('.docy_editor .heading[level="2"]').should('not.exist')

    // Document baseline remains structurally valid after undo.
    cy.get('.docy_editor .heading[level="1"]').should('exist')
    cy.assertFullSchemaValid()
  })

  // ============================================================================
  // I2: Redo after undo - pasted content restored
  // ============================================================================
  it('I2: Redo after undo should restore pasted content', () => {
    const doc = [section('Section', [paragraph('Content')])]
    cy.createDocument(doc)

    // Paste heading content
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.realPress('End')
    pasteHtml('<h2>Redo Heading</h2><p>Redo body</p>')

    // Verify insertion
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'Redo Heading')

    // Undo
    cy.realPress(['Meta', 'z'])
    cy.wait(400)

    // Heading removed
    cy.get('.docy_editor .heading[level="2"]').should('not.exist')

    // Redo
    cy.realPress(['Meta', 'Shift', 'z'])
    cy.wait(400)

    // Heading should be back
    cy.get('.docy_editor .heading[level="2"]').should('exist')
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'Redo Heading')
  })

  // ============================================================================
  // I3: Multiple pastes + undo - correct state sequence
  // ============================================================================
  it('I3: Multiple operations should undo in sequence', () => {
    const doc = [section('Section', [paragraph('Base')])]
    cy.createDocument(doc)

    // First paste
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.realPress('End')
    pasteHtml('<h2>First H2</h2><p>First body</p>')

    // Second paste
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.realPress('End')
    pasteHtml('<h2>Second H2</h2><p>Second body</p>')

    cy.get('.docy_editor .heading[level="2"] .title').contains('First H2')
    cy.get('.docy_editor .heading[level="2"] .title').contains('Second H2')

    // Undo once - should remove second H2
    cy.realPress(['Meta', 'z'])
    cy.wait(400)
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'First H2')
    cy.get('.docy_editor .heading[level="2"] .title').should('not.contain', 'Second H2')
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'First H2')

    // Undo again - should remove first H2 too
    cy.realPress(['Meta', 'z'])
    cy.wait(400)

    cy.get('.docy_editor .heading[level="2"]').should('not.exist')
  })

  // ============================================================================
  // I4: Paste + edit + undo - edit undone, paste remains
  // ============================================================================
  it('I4: Edit after paste should undo independently', () => {
    const doc = [section('Section', [paragraph('Content')])]
    cy.createDocument(doc)

    // Paste heading content
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.realPress('End')
    pasteHtml('<h2>Editable</h2><p>Body</p>')

    // Edit baseline content after paste
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.realType(' local-edit')
    cy.wait(250)

    cy.get('.docy_editor .heading[level="1"] .contentWrapper p')
      .first()
      .should('contain', 'local-edit')

    // Undo the edit
    cy.realPress(['Meta', 'z'])
    cy.wait(400)

    // Edit is undone but pasted content remains.
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p')
      .first()
      .should('not.contain', 'local-edit')
    cy.get('.docy_editor').should('contain', 'Editable')
  })
})
