/* eslint-disable no-undef */

import { paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const TARGET_TEXT = 'target'
const PARAGRAPH_TEXT = 'Apply hyperlink and comment on this target word.'
const TARGET_START = PARAGRAPH_TEXT.indexOf(TARGET_TEXT)
const TARGET_END = TARGET_START + TARGET_TEXT.length

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Shortcut Parity Section', [paragraph(PARAGRAPH_TEXT)])]
}

const selectTargetText = () =>
  cy.createSelection({
    startSection: { title: 'Shortcut Parity Section' },
    startParagraph: { text: PARAGRAPH_TEXT },
    startPosition: TARGET_START,
    endSection: { title: 'Shortcut Parity Section' },
    endParagraph: { text: PARAGRAPH_TEXT },
    endPosition: TARGET_END
  })

describe('Toolbar/Shortcut Parity', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'toolbar-shortcut-parity' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('applies hyperlink with toolbar button', () => {
    selectTargetText()
    cy.get('[data-testid="toolbar-hyperlink"]').click()

    cy.get('.hyperlinkCreatePopover').should('be.visible')
    cy.get('.hyperlinkCreatePopover input[name="hyperlink-url"]')
      .clear()
      .type('https://example.com')
    cy.get('.hyperlinkCreatePopover button[type="submit"]').click()

    cy.get('.docy_editor a')
      .contains(TARGET_TEXT)
      .should('have.attr', 'href')
      .and('include', 'https://example.com')
    cy.assertFullSchemaValid()
  })

  it('applies hyperlink with Mod+K shortcut', () => {
    selectTargetText()
    cy.get('.docy_editor').realPress(['Meta', 'k'])

    cy.get('.hyperlinkCreatePopover').should('be.visible')
    cy.get('.hyperlinkCreatePopover input[name="hyperlink-url"]')
      .clear()
      .type('https://example.org')
    cy.get('.hyperlinkCreatePopover button[type="submit"]').click()

    cy.get('.docy_editor a')
      .contains(TARGET_TEXT)
      .should('have.attr', 'href')
      .and('include', 'https://example.org')
    cy.assertFullSchemaValid()
  })

  it('applies highlight with Mod+Shift+H shortcut', () => {
    selectTargetText()
    cy.get('.docy_editor').realPress(['Meta', 'Shift', 'h'])

    cy.get('.docy_editor mark').contains(TARGET_TEXT).should('exist')
    cy.assertFullSchemaValid()
  })

  it('triggers comment action from toolbar and collapses selection', () => {
    selectTargetText()
    cy.window().then((win) => {
      expect(win._editor.state.selection.empty).to.equal(false)
    })

    cy.get('[data-testid="toolbar-comment"]').click()
    cy.window().then((win) => {
      expect(win._editor.state.selection.empty).to.equal(true)
    })
    cy.assertFullSchemaValid()
  })

  it('triggers comment action with Mod+Alt+M shortcut and collapses selection', () => {
    selectTargetText()
    cy.window().then((win) => {
      expect(win._editor.state.selection.empty).to.equal(false)
    })

    cy.get('.docy_editor').realPress(['Meta', 'Alt', 'm'])
    cy.window().then((win) => {
      expect(win._editor.state.selection.empty).to.equal(true)
    })
    cy.assertFullSchemaValid()
  })
})
