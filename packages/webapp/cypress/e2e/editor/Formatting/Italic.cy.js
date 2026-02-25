/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const getParagraph = () =>
  cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p').first().as('paragraph')

const selectTarget = (text, start, end) =>
  cy.createSelection({
    startSection: 1,
    startParagraph: { text },
    startPosition: start,
    endSection: 1,
    endParagraph: { text },
    endPosition: end
  })

describe('Italic Formatting', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'italic-formatting' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('applies and stops italic with keyboard shortcut', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('Prefix ')
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('@paragraph').realType('italic-target')
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('em').should('contain', 'italic-target')
    cy.get('@paragraph').should('contain', 'Prefix italic-target suffix')
    cy.assertFullSchemaValid()
  })

  it('applies and stops italic with toolbar button', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('Prefix ')
    cy.get('[data-testid="toolbar-italic"]').click()
    cy.get('@paragraph').realType('toolbar-italic')
    cy.get('[data-testid="toolbar-italic"]').click()
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('em').should('contain', 'toolbar-italic')
    cy.get('@paragraph').should('contain', 'Prefix toolbar-italic suffix')
    cy.assertFullSchemaValid()
  })

  it('applies italic on selected text without changing surrounding text', () => {
    const text = 'prefix target suffix'

    getParagraph().click()
    cy.get('@paragraph').realType(text)

    selectTarget(text, 7, 13)
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('@paragraph').find('em').should('contain', 'target')
    cy.get('@paragraph').should('contain', text)
    cy.assertFullSchemaValid()
  })
})
