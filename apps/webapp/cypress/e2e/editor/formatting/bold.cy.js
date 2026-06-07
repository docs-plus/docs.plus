/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const getParagraph = () => cy.get('.docy_editor .tiptap.ProseMirror > p').first().as('paragraph')

const selectTarget = (text, start, end) =>
  cy.createSelection({
    startSection: 1,
    startParagraph: { text },
    startPosition: start,
    endSection: 1,
    endParagraph: { text },
    endPosition: end
  })

describe('Bold Formatting', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'bold-formatting' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('applies and stops bold with keyboard shortcut', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('Prefix ')
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('@paragraph').realType('bold-target')
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('strong').should('contain', 'bold-target')
    cy.get('@paragraph').should('contain', 'Prefix bold-target suffix')
  })

  it('applies and stops bold with toolbar button', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('Prefix ')
    cy.get('[data-testid="toolbar-bold"]').click()
    cy.get('@paragraph').realType('toolbar-bold')
    cy.get('[data-testid="toolbar-bold"]').click()
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('strong').should('contain', 'toolbar-bold')
    cy.get('@paragraph').should('contain', 'Prefix toolbar-bold suffix')
  })

  it('applies bold on selected text without changing surrounding text', () => {
    const text = 'prefix target suffix'

    getParagraph().click()
    cy.get('@paragraph').realType(text)

    selectTarget(text, 7, 13)
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('@paragraph').find('strong').should('contain', 'target')
    cy.get('@paragraph').should('contain', text)
  })
})
