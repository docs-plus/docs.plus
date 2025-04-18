import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Bold Formatting', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'bold-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Bold formatting with keyboard shortcuts', () => {
    it('should select and bold specific words using a simpler approach', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on bold formatting and type "test content"
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get('@paragraph').type('test content')

      // Turn off bold formatting
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor strong').should('exist').and('contain', 'test content')
    })
  })

  describe('Bold formatting with toolbar button', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should make a specific word bold using the toolbar button', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on bold formatting and type "test content"
      cy.get('button[data-tip="Bold (⌘+B)"]').click()

      cy.get('@paragraph').type('test content')

      // Turn off bold formatting
      cy.get('button[data-tip="Bold (⌘+B)"]').click()

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor strong').should('exist').and('contain', 'test content')
    })
  })

  describe('Creating and undoing bold text', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create text with bold formatting and then undo it using keyboard shortcuts', () => {
      // Get the paragraph element and focus it
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')
        .click()

      // Type beginning text without formatting
      cy.get('@paragraph').realType('This contains ')

      // Apply bold formatting and type the bold text
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get('@paragraph').realType('bold formatting')
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      // Type the remaining text
      cy.get('@paragraph').realType(' that will be removed.')

      // Verify bold text exists
      cy.get('.docy_editor strong').should('exist').and('contain', 'bold formatting')

      // Go back to the bold text - first position at the beginning of the bold text
      cy.get('@paragraph').click() // First click to focus
      cy.get('@paragraph').realPress('Home') // Go to start of paragraph

      // Move to start of "bold formatting" (13 = length of "This contains ")
      for (let i = 0; i < 14; i++) {
        cy.get('@paragraph').realPress('ArrowRight')
      }

      // Now select the text using shift+right (15 characters for "bold formatting")
      for (let i = 0; i < 15; i++) {
        cy.get('@paragraph').realPress(['Shift', 'ArrowRight'])
      }

      // Now remove bold formatting with keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      // Verify bold has been removed
      cy.get('.docy_editor strong').should('not.exist')
    })
  })
})
