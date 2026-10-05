/// <reference types="cypress" />

import { expectSelectedFrame } from './selectedFrame'

describe('delete-key collision between text editing and hover controls', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p>hello world</p><p>below</p>')
  })

  it('Backspace with the caret in text deletes the character, not the hovered image', () => {
    cy.getEditor().then((editor) => {
      editor.commands.focus('end')
    })
    cy.insertSizedImage(200, 150)
    cy.nodeCount('image').should('eq', 1)

    cy.get('#editor img').trigger('mouseover', { force: true })
    cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')

    cy.getEditor().then((editor) => {
      editor.commands.focus(12)
    })
    // `realPress` is a parent command: it fires a CDP key event at whatever the
    // browser focuses and ignores any chained subject. Wait for focus to land,
    // or the key goes to <body> and the assertions below race it.
    cy.get('#editor .ProseMirror').should('have.focus')
    cy.realPress('Backspace')

    cy.get('#editor .ProseMirror p').first().should('have.text', 'hello worl')
    cy.nodeCount('image').should('eq', 1)
  })

  it('Backspace at the start of the paragraph after an image selects the image, and the next Backspace deletes it', () => {
    cy.getEditor().then((editor) => {
      editor.commands.focus(13)
    })
    cy.insertSizedImage(200, 150)
    cy.nodeCount('image').should('eq', 1)

    cy.getEditor().then((editor) => {
      let imagePos = -1
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && imagePos === -1) imagePos = pos
      })
      expect(imagePos).to.be.greaterThan(-1)
      const node = editor.state.doc.nodeAt(imagePos)
      editor.commands.focus(imagePos + (node?.nodeSize ?? 1) + 1)
    })
    cy.get('#editor .ProseMirror').should('have.focus')
    cy.realPress('Backspace')

    // No single press deletes media: the first one selects it, visibly.
    cy.nodeCount('image').should('eq', 1)
    expectSelectedFrame()
    cy.getEditor().then((editor) => {
      const selection = editor.state.selection as { node?: { type: { name: string } } }
      expect(selection.node?.type.name, 'NodeSelection on the image').to.eq('image')
    })

    cy.get('#editor .ProseMirror').should('have.focus')
    cy.realPress('Backspace')

    cy.nodeCount('image').should('eq', 0)
    cy.get('#editor .ProseMirror p').first().should('have.text', 'hello world')
    cy.get('#editor .ProseMirror p').last().should('have.text', 'below')
  })
})

export {}
