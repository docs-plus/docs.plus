/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const getTextStartLeft = (li) => {
  const paragraph = li.querySelector('p')
  if (!paragraph) throw new Error('Task list item paragraph not found')

  const walker = li.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let textNode = walker.nextNode()
  while (textNode && !textNode.textContent?.trim()) {
    textNode = walker.nextNode()
  }

  if (!textNode) throw new Error('No text node found in task list item paragraph')

  const range = li.ownerDocument.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, 1)
  return range.getBoundingClientRect().left
}

describe('Task List Alignment', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'task-list-alignment' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('keeps newly created task items aligned to the left', () => {
    cy.get('.docy_editor .tiptap.ProseMirror > p').first().as('paragraph')
    cy.get('@paragraph').click()

    cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])
    cy.get('.docy_editor ul[data-type="taskList"] > li').first().realType('first task item')
    cy.get('.docy_editor ul[data-type="taskList"] > li').first().realPress('Enter')
    cy.get('.docy_editor ul[data-type="taskList"] > li').eq(1).realType('second task item')

    cy.get('.docy_editor ul[data-type="taskList"] > li').should('have.length.at.least', 2)
    cy.get('.docy_editor ul[data-type="taskList"] > li').then(($items) => {
      const firstLeft = getTextStartLeft($items[0])
      const secondLeft = getTextStartLeft($items[1])

      expect(Math.abs(secondLeft - firstLeft)).to.be.lessThan(
        24,
        `Expected task item text to start at approximately same left position (first=${firstLeft}, second=${secondLeft})`
      )
    })
  })

  it('keeps empty focused task items anchored left without breadcrumb placeholders', () => {
    cy.get('.docy_editor .tiptap.ProseMirror > p').first().as('paragraph')
    cy.get('@paragraph').click()

    cy.get('.docy_editor').realPress(['Meta', 'Shift', '9'])
    cy.get('.docy_editor ul[data-type="taskList"] > li').first().realType('anchored task')
    cy.get('.docy_editor ul[data-type="taskList"] > li').first().realPress('Enter')
    cy.get('.docy_editor ul[data-type="taskList"] > li').eq(1).click()

    cy.get('.docy_editor ul[data-type="taskList"] > li').then(($items) => {
      const firstLabelLeft = $items[0].querySelector('label')?.getBoundingClientRect().left
      const secondLabelLeft = $items[1].querySelector('label')?.getBoundingClientRect().left

      expect(firstLabelLeft).to.not.equal(undefined)
      expect(secondLabelLeft).to.not.equal(undefined)
      expect(Math.abs(secondLabelLeft - firstLabelLeft)).to.be.lessThan(
        24,
        `Expected empty task item checkbox to stay aligned (first=${firstLabelLeft}, second=${secondLabelLeft})`
      )
    })

    cy.window().then((win) => {
      const items = win.document.querySelectorAll('.docy_editor ul[data-type="taskList"] > li')
      const secondItem = items[1]
      expect(secondItem, 'second task item should exist').to.not.equal(null)

      const p = secondItem.querySelector('p')
      expect(p, 'paragraph in task item should exist').to.not.equal(null)
      expect(p.textContent.trim(), 'paragraph should be empty').to.equal('')

      const beforeContent = win.getComputedStyle(p, '::before').content
      expect(beforeContent).to.contain('Task item')
    })
  })
})
