import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'

/**
 * Create a test document with multiple sections and headings
 */
const createDocument = () => {
  cy.get('.docy_editor')
    .click()
    .realType(TEST_TITLE.HelloDocy)
    .realPress('Enter')
    .realType(TEST_CONTENT.short)
    .realPress('Enter')
    .realType(TEST_TITLE.short)
    .realPress(['Alt', 'Meta', '1'])
    .realPress('Enter')
    .realType(TEST_CONTENT.short)
    .realPress('Enter')
}

/**
 * Verify that the document is completely empty
 */
const isDocumentEmpty = () => {
  cy.get('.docy_editor .heading[level="1"]')
    .should('have.length', 1)
    .should('have.class', 'is-empty')
    .should('have.class', 'is-editor-empty')
}

/**
 * Apply keyboard shortcuts to clear the document and verify it's empty
 */
const clearDocument = (keySequences) => {
  cy.get('.docy_editor').click()
  keySequences.forEach((keys) => {
    cy.get('.docy_editor').realPress(keys)
  })
  isDocumentEmpty()
}

describe('Document Content Clearing with Keyboard Shortcuts', { testIsolation: false }, () => {
  before(() => {
    cy.viewport(1280, 1900)
    cy.visitEditor({ persist: true, docName: 'empty-doc' })
  })

  const clearScenarios = [
    { label: 'Select All (⌘A) followed by Backspace', keys: [['Meta', 'a'], ['Backspace']] },
    { label: 'Select All (⌘A) followed by Delete', keys: [['Meta', 'a'], ['Delete']] },
    { label: 'Select All and Delete simultaneously (⌘A+Delete)', keys: [['Meta', 'a', 'Delete']] },
    {
      label: 'Select All and Backspace simultaneously (⌘A+Backspace)',
      keys: [['Meta', 'a', 'Backspace']]
    }
  ]

  clearScenarios.forEach((scenario) => {
    it(`clears document using ${scenario.label}`, () => {
      createDocument()
      clearDocument(scenario.keys)
    })
  })
})
