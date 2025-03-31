import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Combined Formatting', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'combined-formatting-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Combined formatting with keyboard shortcuts', () => {
    it('should apply multiple formats (bold + italic) to text', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Type regular text
      cy.get('@paragraph').type('This text has ')

      // Apply bold and italic formatting
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get('.docy_editor').realPress(['Meta', 'i'])

      // Type formatted text
      cy.get('@paragraph').type('bold and italic')

      // Turn off formatting
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      // Continue typing
      cy.get('@paragraph').type(' formatting applied.')

      // Verify the formatted text
      cy.get('.docy_editor strong em').should('exist').and('contain', 'bold and italic')
    })

    it('should apply all formatting (bold + italic + underline + strike) to text', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // Type regular text
      cy.get('@paragraph').type('This text has ')

      // Apply all formatting types
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('.docy_editor').realPress(['Meta', 'u'])
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])

      // Type formatted text
      cy.get('@paragraph').type('all formats')

      // Turn off formatting
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])
      cy.get('.docy_editor').realPress(['Meta', 'u'])
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      // Continue typing
      cy.get('@paragraph').type(' applied to it.')

      // Verify all formatting was applied
      cy.get('.docy_editor strong em s u').should('exist').and('contain', 'all formats')
    })
  })

  describe('Combined formatting with toolbar buttons', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should apply multiple formats (bold + underline) using toolbar buttons', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Type regular text
      cy.get('@paragraph').type('This text has ')

      // Apply bold and underline formatting using toolbar
      cy.get('button[data-tip="Bold (⌘+B)"]').click()
      cy.get('button[data-tip="Underline (⌘+U)"]').click()

      // Type formatted text
      cy.get('@paragraph').type('bold and underline')

      // Turn off formatting
      cy.get('button[data-tip="Underline (⌘+U)"]').click()
      cy.get('button[data-tip="Bold (⌘+B)"]').click()

      // Continue typing
      cy.get('@paragraph').type(' formatting applied.')

      // Verify the formatted text
      cy.get('.docy_editor strong u').should('exist').and('contain', 'bold and underline')
    })
  })

  describe('Applying and removing combined formatting', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should apply combined formatting and then remove individual formats one by one', () => {
      // Get the paragraph element and focus it
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')
        .click()

      // Type beginning text without formatting
      cy.get('@paragraph').realType('This contains ')

      // Apply multiple formats
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('.docy_editor').realPress(['Meta', 'u'])

      // Type with all formats applied
      cy.get('@paragraph').realType('multi-formatted text')

      // Turn off all formatting
      cy.get('.docy_editor').realPress(['Meta', 'u'])
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      // Type remaining text
      cy.get('@paragraph').realType(' in this paragraph.')

      // Verify all formatting was applied
      cy.get('.docy_editor strong em u').should('exist').and('contain', 'multi-formatted text')

      // Go back to the formatted text and select it
      cy.get('@paragraph').click() // Focus
      cy.get('@paragraph').realPress('Home') // Start of paragraph

      // Move to the start of formatted text (14 characters)
      for (let i = 0; i < 14; i++) {
        cy.get('@paragraph').realPress('ArrowRight')
      }

      // Select the formatted text (19 characters)
      for (let i = 0; i < 20; i++) {
        cy.get('@paragraph').realPress(['Shift', 'ArrowRight'])
      }

      cy.wait(500)

      // Remove underline first
      cy.get('.docy_editor').realPress(['Meta', 'u'])

      // Verify underline is removed but other formatting remains
      cy.get('.docy_editor u').should('not.exist')
      cy.get('.docy_editor strong em').should('exist').and('contain', 'multi-formatted text')

      // Remove italic next
      cy.get('.docy_editor').realPress(['Meta', 'i'])

      // Verify italic is removed but bold remains
      cy.get('.docy_editor em').should('not.exist')
      cy.get('.docy_editor strong').should('exist').and('contain', 'multi-formatted text')

      // Finally remove bold
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      // Verify all formatting is removed
      cy.get('.docy_editor strong').should('not.exist')
    })

    it('should be able to add and remove combined formatting using multiple toolbar buttons', () => {
      // Get the paragraph element and focus it
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')
        .click()

      // Type regular text
      cy.get('@paragraph').type('Regular text followed by ')

      // Apply all formattings using toolbar buttons
      cy.get('button[data-tip="Bold (⌘+B)"]').click()
      cy.get('button[data-tip="Italic (⌘+I)"]').click()
      cy.get('button[data-tip="Underline (⌘+U)"]').click()
      cy.get('button[data-tip="Strike (⌘+⇧+S)"]').click()

      // Type with all formats
      cy.get('@paragraph').type('all formatting combined')

      // Remove all formatting using toolbar buttons
      cy.get('button[data-tip="Strike (⌘+⇧+S)"]').click()
      cy.get('button[data-tip="Underline (⌘+U)"]').click()
      cy.get('button[data-tip="Italic (⌘+I)"]').click()
      cy.get('button[data-tip="Bold (⌘+B)"]').click()

      // Type more regular text
      cy.get('@paragraph').type(' and back to regular.')

      // Verify the text had all formatting applied
      cy.get('.docy_editor strong em s u').should('exist').and('contain', 'all formatting combined')
    })
  })
})
