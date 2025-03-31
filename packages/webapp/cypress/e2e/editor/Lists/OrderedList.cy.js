import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Ordered List', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'ordered-list-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Creating ordered lists with keyboard shortcuts', () => {
    it('should create an ordered list using keyboard shortcuts', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create an ordered list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Type the first list item
      cy.get('.docy_editor ol > li').realType('First item in ordered list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ol > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ol > li').eq(1).realType('Second item in ordered list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ol > li').eq(1).realPress('Enter')

      // Type the third list item
      cy.get('.docy_editor ol > li').eq(2).realType('Third item in ordered list')

      // Verify list structure
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ol > li').should('have.length', 3)
      cy.get('.docy_editor ol > li').eq(0).should('contain', 'First item in ordered list')
      cy.get('.docy_editor ol > li').eq(1).should('contain', 'Second item in ordered list')
      cy.get('.docy_editor ol > li').eq(2).should('contain', 'Third item in ordered list')
    })
  })

  describe('Creating ordered lists with toolbar button', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create an ordered list using toolbar button', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Click the ordered list button in the toolbar
      cy.get('button[data-tip="Ordered List (⌘+⇧+7)"]').click()

      // Type the first list item
      cy.get('.docy_editor ol > li').realType('First item in ordered list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ol > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ol > li').eq(1).realType('Second item in ordered list')

      // Verify list structure
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ol > li').should('have.length', 2)
      cy.get('.docy_editor ol > li').eq(0).should('contain', 'First item in ordered list')
      cy.get('.docy_editor ol > li').eq(1).should('contain', 'Second item in ordered list')
    })
  })

  describe('Creating nested ordered lists', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create a nested ordered list structure using tab key', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create an ordered list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Type the first list item
      cy.get('.docy_editor ol > li').realType('First main item')

      // Press Enter to create a new list item
      cy.get('.docy_editor ol > li').realPress('Enter')

      // Indent to create a nested list item
      cy.get('.docy_editor').realPress('Tab')

      // Type the nested list item
      cy.get('.docy_editor ol li ol li').realType('First nested item')

      // Press Enter to create another nested list item
      cy.get('.docy_editor ol li ol li').realPress('Enter')

      // Type the second nested list item
      cy.get('.docy_editor ol li ol li').eq(1).realType('Second nested item')

      // Press Enter and Shift+Tab to un-indent
      cy.get('.docy_editor ol li ol li').eq(1).realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Type the second main list item
      cy.get('.docy_editor ol > li').eq(1).realType('Second main item')

      // Verify the nested list structure
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ol > li').should('have.length.at.least', 2)
      cy.get('.docy_editor ol > li').first().should('contain', 'First main item')
      cy.get('.docy_editor ol > li').last().should('contain', 'Second main item')

      // Verify nested items exist
      cy.get('.docy_editor ol li ol li').should('have.length', 2)
      cy.get('.docy_editor ol li ol li').first().should('contain', 'First nested item')
      cy.get('.docy_editor ol li ol li').last().should('contain', 'Second nested item')
    })
  })

  describe('Converting between list types', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should convert ordered list to bullet list', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create an ordered list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Type the first list item
      cy.get('.docy_editor ol > li').realType('This will be a bullet list item')

      // Select all text in nested list item
      cy.get('.docy_editor ol').then(($ol) => {
        const olElement = $ol.get(0)
        cy.window().then((win) => {
          const range = win.document.createRange()
          range.selectNodeContents(olElement) // Selects the entire contents of the first-level ol
          const selection = win.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        })
      })

      // Convert to bullet list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Verify conversion worked
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ol').should('not.exist')
      cy.get('.docy_editor ul > li').should('have.length', 1)
      cy.get('.docy_editor ul > li').first().should('contain', 'This will be a bullet list item')
    })
  })

  describe('List editing capabilities', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should allow deleting list items and exiting list mode', () => {
      // Get the paragraph element
      cy.get('.docy_editor .contents > p').first().as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create an ordered list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Type the first list item
      cy.get('.docy_editor ol > li').realType('First item')

      // Press Enter to create a new list item
      cy.get('.docy_editor ol > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ol > li').eq(1).realType('Second item')

      // Press Enter to create a new list item
      cy.get('.docy_editor ol > li').eq(1).realPress('Enter')

      // Delete the empty list item to exit list mode (press Enter on empty item)
      cy.get('.docy_editor ol > li').eq(2).realPress('Enter')

      // Type text in normal paragraph
      cy.get('.docy_editor .contents > p').realType('Back to normal text')

      // Verify structure
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ol > li').should('have.length', 2)
      cy.get('.docy_editor .contents > p').should('contain', 'Back to normal text')
    })
  })
})
