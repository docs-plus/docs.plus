import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Bullet List', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'bullet-list-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Creating bullet lists with keyboard shortcuts', () => {
    it('should create a bullet list using keyboard shortcuts', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a bullet list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('First item in bullet list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ul > li').eq(1).realType('Second item in bullet list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').eq(1).realPress('Enter')

      // Type the third list item
      cy.get('.docy_editor ul > li').eq(2).realType('Third item in bullet list')

      // Verify list structure
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ul > li').should('have.length', 3)
      cy.get('.docy_editor ul > li').eq(0).should('contain', 'First item in bullet list')
      cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second item in bullet list')
      cy.get('.docy_editor ul > li').eq(2).should('contain', 'Third item in bullet list')
    })
  })

  describe('Creating bullet lists with toolbar button', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create a bullet list using toolbar button', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Click the bullet list button in the toolbar
      cy.get('button[data-tip="Bullet List (⌘+⇧+8)"]').click()

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('First item in bullet list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ul > li').eq(1).realType('Second item in bullet list')

      // Verify list structure
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ul > li').should('have.length', 2)
      cy.get('.docy_editor ul > li').eq(0).should('contain', 'First item in bullet list')
      cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second item in bullet list')
    })
  })

  describe('Creating nested bullet lists', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create a nested bullet list structure with multiple indentation levels', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a bullet list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('Initial point')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Indent to create a nested list item (level 1)
      cy.get('.docy_editor').realPress('Tab')

      // Type the first nested list item
      cy.get('.docy_editor ul li ul li').realType('Supporting detail 1')

      // Press Enter to create another nested list item
      cy.get('.docy_editor ul li ul li').realPress('Enter')

      // Type the second nested list item
      cy.get('.docy_editor ul li ul li').eq(1).realType('Supporting detail 2')

      // Press Enter to create another nested list item
      cy.get('.docy_editor ul li ul li').eq(1).realPress('Enter')

      // Indent one more level (level 2)
      cy.get('.docy_editor').realPress('Tab')

      // Type deeply nested item
      cy.get('.docy_editor ul li ul li ul li').realType('Sub-detail')

      // Press Enter and go back one indentation level
      cy.get('.docy_editor ul li ul li ul li').realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Type another level 1 item
      cy.get('.docy_editor ul li ul li').eq(2).realType('Supporting detail 3')

      // Press Enter and un-indent to get back to main level
      cy.get('.docy_editor ul li ul li').eq(2).realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Type the second main list item
      cy.get('.docy_editor ul > li').eq(1).realType('Second main point')

      // Verify the nested list structure
      cy.get('.docy_editor ul').should('exist')

      // Verify top-level items
      cy.get('.docy_editor ul > li').should('contain', 'Initial point')
      cy.get('.docy_editor ul > li').should('contain', 'Second main point')

      // Verify level 1 nested items
      cy.get('.docy_editor ul li ul li').should('contain', 'Supporting detail 1')
      cy.get('.docy_editor ul li ul li').should('contain', 'Supporting detail 2')
      cy.get('.docy_editor ul li ul li').should('contain', 'Supporting detail 3')

      // Verify level 2 nested item (deeply nested)
      cy.get('.docy_editor ul li ul li ul li').should('contain', 'Sub-detail')
    })
  })

  describe('Converting between list types', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should convert bullet list to ordered list', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a bullet list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('This will be an ordered list item')

      // Select all text
      cy.get('.docy_editor ul > li').click()
      cy.get('.docy_editor').realPress('Home')
      cy.get('.docy_editor').realPress(['Shift', 'End'])

      // Convert to ordered list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Verify conversion worked
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ul').should('not.exist')
      cy.get('.docy_editor ol > li').should('have.length', 1)
      cy.get('.docy_editor ol > li').first().should('contain', 'This will be an ordered list item')
    })

    it('should convert bullet list to task list', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a bullet list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('This will be a task list item')

      // Select the list item text using keyboard navigation
      cy.get('.docy_editor ul > li').click()
      cy.get('.docy_editor').realPress('Home')
      cy.get('.docy_editor').realPress(['Shift', 'End'])

      // Convert to task list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Verify conversion worked - should now be a task list item with checkbox
      cy.get('.docy_editor input[type="checkbox"]').should('exist')
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ul > li').should('contain', 'This will be a task list item')
    })
  })

  // Not working, need tiptap issue
  // describe('Complex bullet list operations', () => {
  //   beforeEach(() => {
  //     cy.createDocument(DocumentStructure)
  //   })

  //   it('should handle mixed bullet and ordered list structures', () => {
  //     // Get the paragraph element
  //     cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
  //       .first()
  //       .as('paragraph')

  //     // First, click on the paragraph to focus it
  //     cy.get('@paragraph').click()

  //     // Create a bullet list
  //     cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])
  //     cy.get('.docy_editor ul > li').realType('Main bullet item')
  //     cy.get('.docy_editor ul > li').realPress('Enter')

  //     // Indent and convert to ordered list
  //     cy.get('.docy_editor').realPress('Tab')

  //     // Select all text in nested list item
  //     cy.get('.docy_editor ul').then(($ul) => {
  //       const ulElement = $ul.get(0)
  //       cy.window().then((win) => {
  //         const range = win.document.createRange()
  //         range.selectNodeContents(ulElement) // Selects the entire contents of the first-level ul
  //         const selection = win.getSelection()
  //         selection.removeAllRanges()
  //         selection.addRange(range)
  //       })
  //     })

  // Convert to ordered list
  // cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

  // Type content in the ordered sub-list
  // cy.get('.docy_editor ul li ol li').clear().realType('Nested ordered item 1')

  // // Create another ordered list item
  // cy.get('.docy_editor ul li ol li').realPress('Enter')
  // cy.get('.docy_editor ul li ol li').eq(1).realType('Nested ordered item 2')

  // // Go back to bullet list (un-indent and continue with bullet)
  // cy.get('.docy_editor ul li ol li').eq(1).realPress('Enter')
  // cy.get('.docy_editor').realPress(['Shift', 'Tab'])
  // cy.get('.docy_editor ul > li').eq(1).realType('Second main bullet item')

  // // Verify mixed list structure
  // cy.get('.docy_editor ul > li').should('have.length.at.least', 2)
  // cy.get('.docy_editor ul > li').eq(0).should('contain', 'Main bullet item')
  // cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second main bullet item')

  // // Verify ordered sub-list
  // cy.get('.docy_editor ul li ol').should('exist')
  // cy.get('.docy_editor ul li ol li').should('have.length', 2)
  // cy.get('.docy_editor ul li ol li').eq(0).should('contain', 'Nested ordered item 1')
  // cy.get('.docy_editor ul li ol li').eq(1).should('contain', 'Nested ordered item 2')
  // })
  // })
})
