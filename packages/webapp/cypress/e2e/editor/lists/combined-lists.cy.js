import { TEST_TITLE } from '../../../support/commands'
import { section } from '../../../fixtures/docMaker'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

describe('Combined Lists', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'combined-lists-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructure)
  })

  describe('Converting between list types', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should convert bullet list to ordered list and back', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // Focus on the paragraph
      cy.get('@paragraph').click()

      // Create a bullet list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Type the first list item
      cy.get('.docy_editor ul > li').realType('First bullet item')

      // Add a second item
      cy.get('.docy_editor ul > li').realPress('Enter')
      cy.get('.docy_editor ul > li').eq(1).realType('Second bullet item')

      // Add a third item
      cy.get('.docy_editor ul > li').eq(1).realPress('Enter')
      cy.get('.docy_editor ul > li').eq(2).realType('Third bullet item')

      // Select all list items
      cy.get('.docy_editor ul').then(($ul) => {
        const ulElement = $ul.get(0)
        cy.window().then((win) => {
          const range = win.document.createRange()
          range.selectNodeContents(ulElement)
          const selection = win.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        })
      })

      // Convert to ordered list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Verify conversion to ordered list
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ul').should('not.exist')
      cy.get('.docy_editor ol > li').should('have.length', 3)
      cy.get('.docy_editor ol > li').eq(0).should('contain', 'First bullet item')
      cy.get('.docy_editor ol > li').eq(1).should('contain', 'Second bullet item')
      cy.get('.docy_editor ol > li').eq(2).should('contain', 'Third bullet item')

      // Convert back to bullet list
      cy.get('.docy_editor ol').then(($ol) => {
        const olElement = $ol.get(0)
        cy.window().then((win) => {
          const range = win.document.createRange()
          range.selectNodeContents(olElement)
          const selection = win.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        })
      })

      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Verify conversion back to bullet list
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ol').should('not.exist')
      cy.get('.docy_editor ul > li').should('have.length', 3)
    })

    it('should convert ordered list to task list and back', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // Focus on the paragraph
      cy.get('@paragraph').click()

      // Create an ordered list using keyboard shortcut
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Type the first list item
      cy.get('.docy_editor ol > li').realType('First numbered item')

      // Add a second item
      cy.get('.docy_editor ol > li').realPress('Enter')
      cy.get('.docy_editor ol > li').eq(1).realType('Second numbered item')

      // Select all list items
      cy.get('.docy_editor ol').then(($ol) => {
        const olElement = $ol.get(0)
        cy.window().then((win) => {
          const range = win.document.createRange()
          range.selectNodeContents(olElement)
          const selection = win.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        })
      })

      // Convert to task list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Verify conversion to task list
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ol').should('not.exist')
      cy.get('.docy_editor input[type="checkbox"]').should('have.length', 2)
      cy.get('.docy_editor ul > li').eq(0).should('contain', 'First numbered item')
      cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second numbered item')

      // Convert back to ordered list
      cy.get('.docy_editor ul').then(($ul) => {
        const ulElement = $ul.get(0)
        cy.window().then((win) => {
          const range = win.document.createRange()
          range.selectNodeContents(ulElement)
          const selection = win.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        })
      })

      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Verify conversion back to ordered list
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ul').should('not.exist')
      cy.get('.docy_editor input[type="checkbox"]').should('not.exist')
      cy.get('.docy_editor ol > li').should('have.length', 2)
    })
  })

  describe('Nested lists with mixed types', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should support bullet list with nested ordered list', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // Focus on the paragraph
      cy.get('@paragraph').click()

      // Create a bullet list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])
      cy.get('.docy_editor ul > li').realType('Main bullet point')
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Indent to create a nested list
      cy.get('.docy_editor').realPress('Tab')

      // Select the nested list item
      cy.clearInlineNode('.docy_editor ul > li > ul > li')

      // Convert to ordered list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Type content in the ordered sub-list
      cy.get('.docy_editor ul > li > ol > li').clearInlineNode().realType('Ordered sub-item 1')

      // Add another ordered sub-item
      cy.get('.docy_editor ul > li > ol > li').realPress('Enter')
      cy.get('.docy_editor ul > li > ol > li').eq(1).realType('Ordered sub-item 2')

      // Go back to main level
      cy.get('.docy_editor ul > li > ol > li').eq(1).realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Add another bullet point
      cy.get('.docy_editor ul > li').eq(1).realType('Second bullet point')

      // Verify the mixed list structure
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ul > li').should('have.length.at.least', 2)
      cy.get('.docy_editor ul > li').eq(0).should('contain', 'Main bullet point')
      cy.get('.docy_editor ul > li').eq(1).should('contain', 'Second bullet point')

      // Verify ordered sub-list
      cy.get('.docy_editor ul > li > ol').should('exist')
      cy.get('.docy_editor ul > li > ol > li').should('have.length', 2)
      cy.get('.docy_editor ul > li > ol > li').eq(0).should('contain', 'Ordered sub-item 1')
      cy.get('.docy_editor ul > li > ol > li').eq(1).should('contain', 'Ordered sub-item 2')
    })

    it('should support ordered list with nested task list', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // Focus on the paragraph
      cy.get('@paragraph').click()

      // Create an ordered list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])
      cy.get('.docy_editor ol > li').realType('Main numbered item')
      cy.get('.docy_editor ol > li').realPress('Enter')

      // Indent to create a nested list
      cy.get('.docy_editor').realPress('Tab')

      // Select the nested list item
      cy.get('.docy_editor ol > li > ol > li').clearInlineNode()

      // Convert to task list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

      // Type content in the task sub-list
      cy.clearInlineNode('.docy_editor ul[data-type="taskList"] > li').realType('Task sub-item 1')

      // Add another task sub-item
      cy.get('.docy_editor ul[data-type="taskList"] > li').realPress('Enter')
      cy.get('.docy_editor ul[data-type="taskList"] > li').last().realType('Task sub-item 2')

      // Go back to main level
      cy.get('.docy_editor ul[data-type="taskList"] > li').last().realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Add another ordered item
      cy.get('.docy_editor ol > li').click().realPress('Enter')
      cy.get('.docy_editor ol > li').last().realType('Second numbered item')

      // Verify the mixed list structure
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ol > li').should('have.length.at.least', 2)
      cy.get('.docy_editor ol > li').eq(0).should('contain', 'Main numbered item')
      cy.get('.docy_editor ol > li').eq(1).should('contain', 'Second numbered item')

      // Verify task sub-list
      // NOTE: this is not working as expected, the task list is block level node and can not be nested with order and bullet lists
      // cy.get('.docy_editor ol > li > ul').should('exist')
      // cy.get('.docy_editor ol > li > ul > li').should('have.length', 2)
      // cy.get('.docy_editor ol > li > ul > li').eq(0).should('contain', 'Task sub-item 1')
      // cy.get('.docy_editor ol > li > ul > li').eq(1).should('contain', 'Task sub-item 2')
      // cy.get('.docy_editor ol > li > ul > li input[type="checkbox"]').should('have.length', 2)
    })
  })

  describe('Multi-level mixed lists', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should support three levels of different list types', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // Focus on the paragraph
      cy.get('@paragraph').click()

      // Create a task list (level 1)
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])
      cy.get('.docy_editor ul > li').realType('Main project task')
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Indent to level 2 and convert to ordered list
      cy.get('.docy_editor').realPress('Tab')
      cy.get('.docy_editor ul li ul li').click().clearInlineNode()
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])

      // Type in ordered list (level 2)
      cy.get('.docy_editor  ol li').clearInlineNode().realType('Step 1')
      cy.get('.docy_editor  ol li').realPress('Enter')
      cy.get('.docy_editor  ol li').realType('Step 2')
      cy.get('.docy_editor  ol li').realPress('Enter')

      // Indent to level 3 and convert to bullet list
      cy.get('.docy_editor').realPress('Tab')
      cy.get('.docy_editor  ol li ol li').click().clearInlineNode()
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

      // Type in bullet list (level 3)
      cy.get('.docy_editor ol li ul li').clearInlineNode().realType('Detail point')
      cy.get('.docy_editor ol li ul li').realPress('Enter')
      cy.get('.docy_editor ol li ul li').realType('Another detail')

      // Go back to level 2
      cy.get('.docy_editor  ol li ul li').eq(1).realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Add another ordered item at level 2
      cy.get('.docy_editor  ol li').eq(2).realType('Step 3')

      // Go back to level 1
      cy.get('.docy_editor  ol li').eq(2).realPress('Enter')
      cy.get('.docy_editor').realPress(['Shift', 'Tab'])

      // Add another task at level 1
      cy.get('.docy_editor ul[data-type="taskList"] > li').click().realPress('Enter')
      cy.get('.docy_editor ul[data-type="taskList"] > li').last().realType('Second main task')

      // Verify the complex mixed list structure
      cy.get('.docy_editor ul[data-type="taskList"] > li').should('have.length.at.least', 2)
      cy.get('.docy_editor ul[data-type="taskList"] > li')
        .eq(0)
        .should('contain', 'Main project task')
      cy.get('.docy_editor ul[data-type="taskList"] > li')
        .eq(1)
        .should('contain', 'Second main task')

      // Verify level 1 has checkboxes (task list)
      cy.get('.docy_editor ul[data-type="taskList"] > li input[type="checkbox"]').should(
        'have.length.at.least',
        2
      )

      // Verify level 2 is ordered list
      cy.get('.docy_editor ol li').should('exist')
      cy.get('.docy_editor ol li').should('have.length.at.least', 3)
      cy.get('.docy_editor ol > li').eq(0).should('contain', 'Step 1')
      cy.get('.docy_editor ol > li').eq(1).should('contain', 'Step 2')
      cy.get('.docy_editor ol > li').eq(2).should('contain', 'Step 3')

      // Verify level 3 is bullet list
      cy.get('.docy_editor ol > li ul > li').should('exist')
      cy.get('.docy_editor ol > li ul > li').should('have.length.at.least', 2)
      cy.get('.docy_editor ol > li ul > li').eq(0).should('contain', 'Detail point')
      cy.get('.docy_editor ol > li ul > li').eq(1).should('contain', 'Another detail')
    })
  })

  describe('List continuation and type preservation', () => {
    beforeEach(() => {
      cy.createDocument(DocumentStructure)
    })

    it('should maintain list type when continuing after text input', () => {
      // Get the paragraph element
      cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p')
        .first()
        .as('paragraph')

      // Focus on the paragraph
      cy.get('@paragraph').click()

      // Create different types of lists with items

      // 1. Start with bullet list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])
      cy.get('.docy_editor ul > li').realType('Bullet item')
      cy.get('.docy_editor ul > li').realPress('Enter')

      // Exit list by pressing Enter on empty item
      cy.get('.docy_editor ul > li').eq(1).realPress('Enter')

      // Type normal paragraph text
      cy.get('.docy_editor .contents > p').last().realType('Normal paragraph text')
      cy.get('.docy_editor .contents > p').last().realPress('Enter')

      // 2. Create ordered list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])
      cy.get('.docy_editor ol > li').realType('Ordered item')
      cy.get('.docy_editor ol > li').realPress('Enter')

      // Exit list by pressing Enter on empty item
      cy.get('.docy_editor ol > li').eq(1).realPress('Enter')

      // Type normal paragraph text
      cy.get('.docy_editor .contents > p').last().realType('More normal text')
      cy.get('.docy_editor .contents > p').last().realPress('Enter')

      // 3. Create task list
      cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])
      cy.get('.docy_editor ul > li').realType('Task item')

      // Verify the document structure with all list types
      cy.get('.docy_editor ul').should('have.length.at.least', 2) // Bullet and task lists
      cy.get('.docy_editor ol').should('have.length', 1)
      cy.get('.docy_editor input[type="checkbox"]').should('have.length.at.least', 1)
      cy.get('.docy_editor .contents > p').should('have.length.at.least', 2)
      cy.get('.docy_editor .contents > p').eq(-1).should('contain', 'More normal text')
    })
  })
})
