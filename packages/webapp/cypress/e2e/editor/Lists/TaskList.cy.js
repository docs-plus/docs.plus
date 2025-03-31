import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Task List', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'task-list-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Creating task lists with keyboard shortcuts', () => {
    it('should create a task list using keyboard shortcuts', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a task list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('First task in list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ul > li').eq(1).realType('Second task in list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').eq(1).realPress('Enter')

      // Type the third list item
      cy.get('.docy_editor ul > li').eq(2).realType('Third task in list')

      // Verify list structure
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ul > li').should('have.length', 3)
      cy.get('.docy_editor input[type="checkbox"]').should('have.length', 3)
      cy.get('.docy_editor ul > li').eq(0).should('contain', 'First task in list')
      cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second task in list')
      cy.get('.docy_editor ul > li').eq(2).should('contain', 'Third task in list')
    })
  })

  describe('Creating task lists with toolbar button', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create a task list using toolbar button', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Click the task list button in the toolbar
      cy.get('button[data-tip="Task List (⌘+⇧+9)"]').click()

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('First task in list')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ul > li').eq(1).realType('Second task in list')

      // Verify list structure
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ul > li').should('have.length', 2)
      cy.get('.docy_editor input[type="checkbox"]').should('have.length', 2)
      cy.get('.docy_editor ul > li').eq(0).should('contain', 'First task in list')
      cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second task in list')
    })
  })

  describe('Creating nested task lists', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should create a nested task list structure using tab key', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a task list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('Main task')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Indent to create a nested list item
      cy.get('.docy_editor').realPress('Tab')

      // Type the nested list item
      cy.get('.docy_editor ul li ul li').realType('Subtask 1')

      // Press Enter to create another nested list item
      cy.get('.docy_editor ul li ul li').realPress('Enter')

      // Type the second nested list item
      cy.get('.docy_editor ul li ul li').eq(1).realType('Subtask 2')

      // Press Enter and Shift+Tab to un-indent
      cy.get('.docy_editor ul li ul li').eq(1).realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Type the second main list item
      cy.get('.docy_editor ul > li').eq(1).realType('Another main task')

      // Verify the nested list structure
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor input[type="checkbox"]').should('have.length.at.least', 4)

      // Verify main tasks
      cy.get('.docy_editor ul > li').first().should('contain', 'Main task')
      cy.get('.docy_editor ul > li').last().should('contain', 'Another main task')

      // Verify subtasks
      cy.get('.docy_editor ul li ul li').should('have.length', 2)
      cy.get('.docy_editor ul li ul li').eq(0).should('contain', 'Subtask 1')
      cy.get('.docy_editor ul li ul li').eq(1).should('contain', 'Subtask 2')
    })
  })

  describe('Toggling task checkboxes', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should toggle task checkboxes when clicked', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a task list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('Task to complete')

      // Press Enter to create a new list item
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Type the second list item
      cy.get('.docy_editor ul > li').eq(1).realType('Another task to complete')

      // Verify checkboxes are initially unchecked
      cy.get('.docy_editor input[type="checkbox"]').should('have.length', 2)
      cy.get('.docy_editor input[type="checkbox"]').eq(0).should('not.be.checked')
      cy.get('.docy_editor input[type="checkbox"]').eq(1).should('not.be.checked')

      // Click the first checkbox to check it
      cy.get('.docy_editor input[type="checkbox"]').eq(0).click()

      // Verify the first checkbox is now checked
      cy.get('.docy_editor input[type="checkbox"]').eq(0).should('be.checked')
      cy.get('.docy_editor input[type="checkbox"]').eq(1).should('not.be.checked')

      // Click the second checkbox to check it
      cy.get('.docy_editor input[type="checkbox"]').eq(1).click()

      // Verify both checkboxes are now checked
      cy.get('.docy_editor input[type="checkbox"]').eq(0).should('be.checked')
      cy.get('.docy_editor input[type="checkbox"]').eq(1).should('be.checked')

      // Click the first checkbox again to uncheck it
      cy.get('.docy_editor input[type="checkbox"]').eq(0).click()

      // Verify the first checkbox is now unchecked again
      cy.get('.docy_editor input[type="checkbox"]').eq(0).should('not.be.checked')
      cy.get('.docy_editor input[type="checkbox"]').eq(1).should('be.checked')
    })
  })

  describe('Converting between list types', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should convert task list to bullet list', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a task list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Type the first list item
      cy.get('.docy_editor ul > li').type('This will be a bullet list item')

      // Select just the list item text
      cy.get('.docy_editor ul > li').click()
      cy.get('.docy_editor').realPress('Home')
      cy.get('.docy_editor').realPress(['Shift', 'End'])

      // Convert to bullet list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Verify conversion worked - should now be a regular bullet list without checkboxes
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor input[type="checkbox"]').should('not.exist')
      cy.get('.docy_editor ul > li').should('have.length', 1)
      cy.get('.docy_editor ul > li').first().should('contain', 'This will be a bullet list item')
    })

    it('should convert task list to ordered list', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // First, click on the paragraph to focus it
      cy.get('@paragraph').click()

      // Create a task list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Type the first list item
      cy.get('.docy_editor ul > li').type('This will be an ordered list item')

      // Select just the list item text
      cy.get('.docy_editor ul > li').click()
      cy.get('.docy_editor').realPress('Home')
      cy.get('.docy_editor').realPress(['Shift', 'End'])

      // Convert to ordered list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Verify conversion worked
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ul').should('not.exist')
      cy.get('.docy_editor input[type="checkbox"]').should('not.exist')
      cy.get('.docy_editor ol > li').should('have.length', 1)
      cy.get('.docy_editor ol > li').first().should('contain', 'This will be an ordered list item')
    })
  })

  // Not working, need tiptap issue
  // describe('Complex task list operations', () => {
  //   beforeEach(() => {
  //     cy.createDocument(DocumentStructure)
  //   })

  //   it('should create a mixed structure with task lists and other list types', () => {
  //     // Get the paragraph element
  //     cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
  //       .first()
  //       .as('paragraph')

  //     // First, click on the paragraph to focus it
  //     cy.get('@paragraph').click()

  //     // Create a task list
  //     cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])
  //     cy.get('.docy_editor ul > li').realType('Main task')
  //     cy.get('.docy_editor ul > li').realPress('Enter')

  //     // Indent and convert to ordered list
  //     cy.get('.docy_editor ul > li').eq(1).realPress('Tab')

  //     // Select all text in nested list item
  //     cy.get('.docy_editor ul > li').then(($ol) => {
  //       const olElement = $ol.get(0)
  //       cy.window().then((win) => {
  //         const range = win.document.createRange()
  //         range.selectNodeContents(olElement) // Selects the entire contents of the first-level ol
  //         const selection = win.getSelection()
  //         selection.removeAllRanges()
  //         selection.addRange(range)
  //       })
  //     })

  //     // cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

  //     // // Type content in the ordered sub-list
  //     // cy.get('.docy_editor ul li ol li').clear().realType('Step 1')

  //     // // Create another ordered list item
  //     // cy.get('.docy_editor ul li ol li').realPress('Enter')
  //     // cy.get('.docy_editor ul li ol li').eq(1).realType('Step 2')

  //     // // Press Enter and indent to create a bullet list
  //     // cy.get('.docy_editor ul li ol li').eq(1).realPress('Enter')
  //     // cy.get('.docy_editor').realPress('Tab')

  //     // // Select the list item text using keyboard navigation
  //     // cy.get('.docy_editor ul li ol li').click()
  //     // cy.get('.docy_editor').realPress('Home')
  //     // cy.get('.docy_editor').realPress(['Shift', 'End'])

  //     // cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

  //     // // Type content in the bullet sub-list
  //     // cy.get('.docy_editor ul li ol li ul li').clear().realType('Sub-bullet point')

  //     // // Go back to task list (un-indent twice and continue with task list)
  //     // cy.get('.docy_editor ul li ol li ul li').realPress('Enter')
  //     // cy.get('.docy_editor').realPress(['Shift', 'Tab'])
  //     // cy.get('.docy_editor').realPress(['Shift', 'Tab'])
  //     // cy.get('.docy_editor ul > li').eq(1).realType('Second main task')

  //     // // Verify complex mixed list structure
  //     // cy.get('.docy_editor ul > li').should('have.length.at.least', 2)
  //     // cy.get('.docy_editor ul > li').eq(0).should('contain', 'Main task')
  //     // cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second main task')

  //     // // Verify ordered sub-list
  //     // cy.get('.docy_editor ul li ol').should('exist')
  //     // cy.get('.docy_editor ul li ol li').should('contain', 'Step 1')
  //     // cy.get('.docy_editor ul li ol li').should('contain', 'Step 2')

  //     // // Verify bullet sub-sub-list
  //     // cy.get('.docy_editor ul li ol li ul').should('exist')
  //     // cy.get('.docy_editor ul li ol li ul li').should('contain', 'Sub-bullet point')

  //     // // Verify checkboxes exist on task list items but not on other list types
  //     // cy.get('.docy_editor ul > li input[type="checkbox"]').should('have.length.at.least', 2)
  //     // cy.get('.docy_editor ul li ol li input[type="checkbox"]').should('not.exist')

  //     // // Later, when converting nested ordered list item to bullet list
  //     // cy.get('.docy_editor ul li ol li').eq(2).realPress('Tab')

  //     // // Select just this list item
  //     // cy.get('.docy_editor ul li ol li').eq(2).click()
  //     // cy.get('.docy_editor').realPress('Home')
  //     // cy.get('.docy_editor').realPress(['Shift', 'End'])

  //     // cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])
  //   })
  // })
})
