/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const SimpleDocument = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const DeepHierarchyDocument = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Section 1', [heading(2, 'S1-H2', [heading(4, 'S1-H4', [paragraph('leaf 1')])])]),
    section('Section 2', [heading(3, 'S2-H3', [paragraph('leaf 2')])]),
    section('Section 3', [heading(2, 'S3-H2', [heading(5, 'S3-H5', [paragraph('leaf 3')])])]),
    section('Section 4', [
      heading(2, 'S4-H2', [heading(3, 'S4-H3', [heading(7, 'S4-H7', [paragraph('deep leaf')])])])
    ]),
    section('Section 5', [heading(4, 'S5-H4', [paragraph('leaf 5')])]),
    section('Section 6', [heading(2, 'S6-H2', [heading(8, 'S6-H8', [paragraph('leaf 6')])])]),
    section('Section 7', [heading(9, 'S7-H9', [paragraph('leaf 7')])])
  ]
}

describe('List Edge Cases', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'list-edge-cases' })
  })

  it('toggles bullet list off and restores paragraph content', () => {
    cy.createDocument(SimpleDocument)
    cy.wait(150)

    cy.get('.docy_editor .tiptap.ProseMirror > p').first().click()
    cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])
    cy.get('.docy_editor ul > li').first().realType('toggle bullet off')

    cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

    cy.get('.docy_editor ul').should('not.exist')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'toggle bullet off')
  })

  it('exits task list on empty item and continues in paragraph', () => {
    cy.createDocument(SimpleDocument)
    cy.wait(150)

    cy.get('.docy_editor .tiptap.ProseMirror > p').first().click()
    cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])
    cy.get('.docy_editor ul[data-type="taskList"] > li').first().realType('first task')
    cy.get('.docy_editor ul[data-type="taskList"] > li').first().realPress('Enter')
    cy.get('.docy_editor ul[data-type="taskList"] > li').eq(1).realPress('Enter')

    cy.get('.docy_editor > .tiptap.ProseMirror').realType('paragraph after task list')

    cy.get('.docy_editor ul[data-type="taskList"] > li').should('have.length', 1)
    cy.get('.docy_editor ul[data-type="taskList"] > li').first().should('contain', 'first task')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'paragraph after task list')
  })

  it('safely exits root bullet list when outdenting at top level', () => {
    cy.createDocument(SimpleDocument)
    cy.wait(150)

    cy.get('.docy_editor .tiptap.ProseMirror > p').first().click()
    cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])
    cy.get('.docy_editor ul > li').first().realType('top level bullet')

    cy.get('.docy_editor').realPress(['Shift', 'Tab'])

    cy.get('.docy_editor ul').should('not.exist')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'top level bullet')
  })

  it('handles nested ordered list break and converts ordered structure to unordered', () => {
    cy.createDocument(SimpleDocument)
    cy.wait(150)

    cy.get('.docy_editor .tiptap.ProseMirror > p').first().click()
    cy.createOrderedList([
      { text: 'Root item 1', indent: 0 },
      { text: 'Root item 2', indent: 0 },
      { text: 'Nested item 2.1', indent: 1 },
      { text: 'Nested item 2.2', indent: 1 },
      { text: 'Root item 3', indent: 0 }
    ])

    // createOrderedList exits the list on the last item; ensure we can continue in paragraph
    cy.get('.docy_editor > .tiptap.ProseMirror').realType('paragraph after ordered break')
    cy.get('.docy_editor .tiptap.ProseMirror > p')
      .last()
      .should('contain', 'paragraph after ordered break')

    cy.get('.docy_editor .tiptap.ProseMirror > ol').then(($ol) => {
      const list = $ol.get(0)
      cy.window().then((win) => {
        const range = win.document.createRange()
        range.selectNodeContents(list)
        const selection = win.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
      })
    })

    cy.get('.docy_editor').realPress(['Meta', 'Shift', '8'])

    cy.get('.docy_editor .tiptap.ProseMirror > ul').should('exist')
    cy.get('.docy_editor .tiptap.ProseMirror > ol').should('not.exist')
    cy.get('.docy_editor .tiptap.ProseMirror > ul').should('contain', 'Nested item 2.1')
  })

  it('converts only a selected subset of ordered items into task list items', () => {
    cy.createDocument(SimpleDocument)
    cy.wait(150)

    cy.get('.docy_editor .tiptap.ProseMirror > p').first().click()
    cy.get('.docy_editor').realPress(['Meta', 'Shift', '7'])
    cy.get('.docy_editor ol > li').first().realType('Step 1 keep ordered')
    cy.get('.docy_editor ol > li').first().realPress('Enter')
    cy.get('.docy_editor ol > li').eq(1).realType('Step 2 convert to task')
    cy.get('.docy_editor ol > li').eq(1).realPress('Enter')
    cy.get('.docy_editor ol > li').eq(2).realType('Step 3 convert to task')
    cy.get('.docy_editor ol > li').eq(2).realPress('Enter')
    cy.get('.docy_editor ol > li').eq(3).realType('Step 4 keep ordered')

    cy.createSelection({
      startSection: 1,
      startParagraph: { text: 'Step 2 convert to task' },
      startPosition: 'start',
      endSection: 1,
      endParagraph: { text: 'Step 3 convert to task' },
      endPosition: 'end'
    })
    cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])

    cy.contains('.docy_editor ul[data-type="taskList"] > li', 'Step 2 convert to task').should(
      'exist'
    )
    cy.contains('.docy_editor ul[data-type="taskList"] > li', 'Step 3 convert to task').should(
      'exist'
    )
    cy.get('.docy_editor ul[data-type="taskList"] input[type="checkbox"]').should(
      'have.length.at.least',
      2
    )

    cy.contains('.docy_editor ol > li', 'Step 1 keep ordered').should('exist')
    cy.contains('.docy_editor ol > li', 'Step 4 keep ordered').should('exist')
  })

  it('creates list content inside deep heading in a 7-section hierarchy', () => {
    cy.createDocument(DeepHierarchyDocument)
    cy.wait(300)

    cy.get('.docy_editor > .tiptap > h1[data-toc-id]').should('have.length', 7)

    cy.putPosCaretInHeading(7, 'S4-H7', 'end')
    cy.realPress('Enter')
    cy.get('.docy_editor > .tiptap.ProseMirror').realType('deep list item')
    cy.get('[data-testid="toolbar-ordered-list"]').click()

    cy.get('.docy_editor .tiptap.ProseMirror ol li').should('contain', 'deep list item')
    cy.get('.docy_editor > .tiptap > h1[data-toc-id]').should('have.length.gte', 1)
  })
})
