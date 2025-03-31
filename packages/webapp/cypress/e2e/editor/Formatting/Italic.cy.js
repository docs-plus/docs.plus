import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Italic Formatting', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'italic-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Italic formatting with keyboard shortcuts', () => {
    it('should select and italicize specific words using a simpler approach', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on italic formatting and type "test content"
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('@paragraph').type('test content')

      // Turn off italic formatting
      cy.get('.docy_editor').realPress(['Meta', 'i'])

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor em').should('exist').and('contain', 'test content')
    })
  })

  describe('Italic formatting with toolbar button', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should make a specific word italic using the toolbar button', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on italic formatting and type "test content"
      cy.get('button[data-tip="Italic (⌘+I)"]').click()

      cy.get('@paragraph').type('test content')

      // Turn off italic formatting
      cy.get('button[data-tip="Italic (⌘+I)"]').click()

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor em').should('exist').and('contain', 'test content')
    })
  })

  describe('Creating and undoing italic text', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create text with italic formatting and then undo it using keyboard shortcuts', () => {
      // Get the paragraph element and focus it
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')
        .click()

      // Type beginning text without formatting
      cy.get('@paragraph').realType('This contains ')

      // Apply italic formatting and type the italic text
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('@paragraph').realType('italic formatting')
      cy.get('.docy_editor').realPress(['Meta', 'i'])

      // Type the remaining text
      cy.get('@paragraph').realType(' that will be removed.')

      // Verify italic text exists
      cy.get('.docy_editor em').should('exist').and('contain', 'italic formatting')

      // Go back to the italic text - first position at the beginning of the italic text
      cy.get('@paragraph').click() // First click to focus
      cy.get('@paragraph').realPress('Home') // Go to start of paragraph

      // Move to start of "italic formatting" (14 = length of "This contains ")
      for (let i = 0; i < 14; i++) {
        cy.get('@paragraph').realPress('ArrowRight')
      }

      // Now select the text using shift+right (17 characters for "italic formatting")
      for (let i = 0; i < 17; i++) {
        cy.get('@paragraph').realPress(['Shift', 'ArrowRight'])
      }

      // Now remove italic formatting with keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'i'])

      // Verify italic has been removed
      cy.get('.docy_editor em').should('not.exist')
    })
  })
})
