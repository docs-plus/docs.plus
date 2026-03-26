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

describe('Highlight Formatting', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'highlight-formatting' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('applies and stops highlight with toolbar action', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('Prefix ')
    cy.get('[data-testid="toolbar-highlight"]').click()
    cy.get('@paragraph').realType('highlight-target')
    cy.get('[data-testid="toolbar-highlight"]').click()
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('mark').should('contain', 'highlight-target')
    cy.get('@paragraph').should('contain', 'Prefix highlight-target suffix')
  })

  it('combines highlight with bold on selected text', () => {
    const text = 'prefix target suffix'

    getParagraph().click()
    cy.get('@paragraph').realType(text)

    selectTarget(text, 7, 13)
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('[data-testid="toolbar-highlight"]').click()

    cy.get('@paragraph').find('strong').should('contain', 'target')
    cy.get('@paragraph').find('mark').should('contain', 'target')
  })

  it('applies highlight with Mod+Shift+H shortcut', () => {
    const text = 'prefix shortcut-target suffix'

    getParagraph().click()
    cy.get('@paragraph').realType(text)

    selectTarget(text, 7, 22)
    cy.get('.docy_editor').realPress(['Meta', 'Shift', 'h'])
    cy.get('@paragraph').find('mark').should('contain', 'shortcut-target')
  })
})
