import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Strike Formatting', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'strike-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Strike formatting with keyboard shortcuts', () => {
    it('should select and strikethrough specific words using a simpler approach', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on strike formatting and type "test content"
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])
      cy.get('@paragraph').type('test content')

      // Turn off strike formatting
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor s').should('exist').and('contain', 'test content')
    })
  })

  describe('Strike formatting with toolbar button', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should make a specific word strikethrough using the toolbar button', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Now we'll type "This is a " without formatting
      cy.get('@paragraph').type('This is a ')

      // Now we'll turn on strike formatting and type "test content"
      cy.get('button[data-tip="Strike (⌘+⇧+S)"]').click()

      cy.get('@paragraph').type('test content')

      // Turn off strike formatting
      cy.get('button[data-tip="Strike (⌘+⇧+S)"]').click()

      // Continue typing regular text
      cy.get('@paragraph').type(' for basic testing scenarios.')

      // Verify the formatted text exists in the paragraph
      cy.get('.docy_editor s').should('exist').and('contain', 'test content')
    })
  })

  describe('Creating and undoing strikethrough text', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create text with strike formatting and then undo it using keyboard shortcuts', () => {
      // Get the paragraph element and focus it
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')
        .click()

      // Type beginning text without formatting
      cy.get('@paragraph').realType('This contains ')

      // Apply strike formatting and type the strikethrough text
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])
      cy.get('@paragraph').realType('strikethrough formatting')
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])

      // Type the remaining text
      cy.get('@paragraph').realType(' that will be removed.')

      // Verify strikethrough text exists
      cy.get('.docy_editor s').should('exist').and('contain', 'strikethrough formatting')

      // Go back to the strikethrough text - first position at the beginning of the strikethrough text
      cy.get('@paragraph').click() // First click to focus
      cy.get('@paragraph').realPress('Home') // Go to start of paragraph

      // Move to start of "strikethrough formatting" (14 = length of "This contains ")
      for (let i = 0; i < 14; i++) {
        cy.get('@paragraph').realPress('ArrowRight')
      }

      // Now select the text using shift+right (24 characters for "strikethrough formatting")
      for (let i = 0; i < 24; i++) {
        cy.get('@paragraph').realPress(['Shift', 'ArrowRight'])
      }

      // Now remove strike formatting with keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])

      // Verify strike has been removed
      cy.get('.docy_editor s').should('not.exist')
    })
  })
})
