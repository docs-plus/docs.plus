/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const getParagraph = () =>
  cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p').first().as('paragraph')

const setSelectionBySubstring = (target) =>
  cy.window().then((win) => {
    const editor = win._editor
    let from = null
    let to = null

    editor.state.doc.descendants((node, pos) => {
      if (from !== null) return false
      if (!node.isText || !node.text) return true

      const index = node.text.indexOf(target)
      if (index === -1) return true

      from = pos + index
      to = from + target.length
      return false
    })

    if (from === null || to === null) {
      throw new Error(`Could not find "${target}" in editor document`)
    }

    editor.commands.setTextSelection({ from, to })
  })

describe('Extended Formatting Marks', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'extended-formatting' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('applies inline code mark with Mod+E shortcut', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('prefix inline-token suffix')

    setSelectionBySubstring('inline-token')
    cy.get('.docy_editor').realPress(['Meta', 'e'])

    cy.get('@paragraph').find('code').should('contain', 'inline-token')
    cy.assertFullSchemaValid()
  })

  it('applies superscript and subscript with shortcuts (Mod+. and Mod+,)', () => {
    getParagraph().click()
    cy.get('@paragraph').realType('E = mc2 and H2O')

    setSelectionBySubstring('2')
    cy.get('.docy_editor').realPress(['Meta', '.'])

    // Select the second "2" inside H2O (the first one is now in <sup>2</sup>)
    setSelectionBySubstring('2O')
    cy.window().then((win) => {
      const editor = win._editor
      const { from } = editor.state.selection
      editor.commands.setTextSelection({ from, to: from + 1 })
    })
    cy.get('.docy_editor').realPress(['Meta', ','])

    cy.get('@paragraph').find('sup').should('contain', '2')
    cy.get('@paragraph').find('sub').should('contain', '2')
    cy.assertFullSchemaValid()
  })
})
