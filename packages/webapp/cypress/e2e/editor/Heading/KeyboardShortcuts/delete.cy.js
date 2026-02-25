/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../../fixtures/docMaker'

describe('Heading Keyboard Shortcut - Delete', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'heading-delete-shortcuts' })
  })

  it('deletes a cross-block range and keeps schema valid', () => {
    cy.createDocument([
      section('Root', [paragraph('First paragraph text'), paragraph('Second paragraph text')])
    ])
    cy.wait(300)

    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      let from = null
      let to = null

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.textContent.includes('First paragraph')) {
          from = pos + 3
        }
        if (node.type.name === 'paragraph' && node.textContent.includes('Second paragraph')) {
          to = pos + 6
        }
      })

      if (from && to) {
        editor.commands.setTextSelection({ from, to })
      }
    })

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Delete')
    cy.wait(400)
    cy.assertFullSchemaValid()
  })

  it('deletes next character in heading title when caret is in the middle', () => {
    cy.createDocument([section('Root', [heading(2, 'Test Delete', [paragraph('body')])])])
    cy.wait(300)

    cy.putPosCaretInHeading(2, 'Test Delete', 4)
    cy.realPress('Delete')
    cy.wait(200)

    cy.get('.heading[level="2"] .title').should('contain', 'TestDelete')
    cy.assertFullSchemaValid()
  })
})
