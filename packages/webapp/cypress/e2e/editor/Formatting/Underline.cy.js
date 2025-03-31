import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Underline Formatting', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'underline-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Underline formatting with keyboard shortcuts', () => {
    it('should select and underline specific words using a simpler approach', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on underline formatting and type "test content"
      cy.get('.docy_editor').realPress(['Meta', 'u'])
      cy.get('@paragraph').type('test content')

      // Turn off underline formatting
      cy.get('.docy_editor').realPress(['Meta', 'u'])

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor u').should('exist').and('contain', 'test content')
    })
  })

  describe('Underline formatting with toolbar button', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should make a specific word underlined using the toolbar button', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on underline formatting and type "test content"
      cy.get('button[data-tip="Underline (⌘+U)"]').click()

      cy.get('@paragraph').type('test content')

      // Turn off underline formatting
      cy.get('button[data-tip="Underline (⌘+U)"]').click()

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor u').should('exist').and('contain', 'test content')
    })
  })

  describe('Creating and undoing underlined text', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create text with underline formatting and then undo it using keyboard shortcuts', () => {
      // Get the paragraph element and focus it
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')
        .click()

      // Type beginning text without formatting
      cy.get('@paragraph').realType('This contains ')

      // Apply underline formatting and type the underlined text
      cy.get('.docy_editor').realPress(['Meta', 'u'])
      cy.get('@paragraph').realType('underlined formatting')
      cy.get('.docy_editor').realPress(['Meta', 'u'])

      // Type the remaining text
      cy.get('@paragraph').realType(' that will be removed.')

      // Verify underlined text exists
      cy.get('.docy_editor u').should('exist').and('contain', 'underlined formatting')

      // Go back to the underlined text - first position at the beginning of the underlined text
      cy.get('@paragraph').click() // First click to focus
      cy.get('@paragraph').realPress('Home') // Go to start of paragraph

      // Move to start of "underlined formatting" (14 = length of "This contains ")
      for (let i = 0; i < 14; i++) {
        cy.get('@paragraph').realPress('ArrowRight')
      }

      // Now select the text using shift+right (21 characters for "underlined formatting")
      for (let i = 0; i < 21; i++) {
        cy.get('@paragraph').realPress(['Shift', 'ArrowRight'])
      }

      // Now remove underline formatting with keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'u'])

      // Verify underline has been removed
      cy.get('.docy_editor u').should('not.exist')
    })
  })
})
