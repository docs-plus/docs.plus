/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../../fixtures/docMaker'

describe('Heading Keyboard Shortcut - Enter', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'heading-enter-shortcuts' })
  })

  it('creates a paragraph in contentWrapper when pressing Enter at heading title end', () => {
    cy.createDocument([section('Root', [heading(2, 'My Heading', [paragraph('existing body')])])])
    cy.wait(300)

    cy.putPosCaretInHeading(2, 'My Heading', 'end')
    cy.realPress('Enter')
    cy.wait(200)
    cy.realType('Inserted from enter')
    cy.wait(200)

    cy.get('.heading[level="2"] .contentWrapper').should('contain', 'Inserted from enter')
    cy.assertFullSchemaValid()
  })

  it('splits heading text when pressing Enter in the middle of the title', () => {
    cy.createDocument([section('Root', [heading(2, 'FirstSecond', [paragraph('existing body')])])])
    cy.wait(300)

    cy.putPosCaretInHeading(2, 'FirstSecond', 5)
    cy.realPress('Enter')
    cy.wait(300)

    cy.get('.heading[level="2"] .title').should('contain', 'First')
    cy.get('.heading[level="2"] .contentWrapper').should('contain', 'Second')
    cy.assertFullSchemaValid()
  })
})
