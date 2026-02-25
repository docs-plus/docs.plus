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

describe('Underline Formatting', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'underline-formatting' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('applies and stops underline with keyboard shortcut', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('Prefix ')
    cy.get('.docy_editor').realPress(['Meta', 'u'])
    cy.get('@paragraph').realType('underline-target')
    cy.get('.docy_editor').realPress(['Meta', 'u'])
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('u').should('contain', 'underline-target')
    cy.get('@paragraph').should('contain', 'Prefix underline-target suffix')
    cy.assertFullSchemaValid()
  })

  it('applies and stops underline with toolbar button', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('Prefix ')
    cy.get('[data-testid="toolbar-underline"]').click()
    cy.get('@paragraph').realType('toolbar-underline')
    cy.get('[data-testid="toolbar-underline"]').click()
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('u').should('contain', 'toolbar-underline')
    cy.get('@paragraph').should('contain', 'Prefix toolbar-underline suffix')
    cy.assertFullSchemaValid()
  })

  it('applies underline on selected text without changing surrounding text', () => {
    const text = 'prefix target suffix'

    getParagraph().click()
    cy.get('@paragraph').realType(text)

    selectTarget(text, 7, 13)
    cy.get('.docy_editor').realPress(['Meta', 'u'])
    cy.get('@paragraph').find('u').should('contain', 'target')
    cy.get('@paragraph').should('contain', text)
    cy.assertFullSchemaValid()
  })
})
