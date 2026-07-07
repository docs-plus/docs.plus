/// <reference types="cypress" />

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

    // Arm the hover controls on the image…
    cy.get('#editor img').trigger('mouseover', { force: true })
    cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')

    // …while the focused caret sits at the end of "hello world".
    cy.getEditor().then((editor) => {
      editor.commands.focus(12)
    })
    cy.get('#editor .ProseMirror').realPress('Backspace')

    cy.get('#editor .ProseMirror p').first().should('have.text', 'hello worl')
    cy.nodeCount('image').should('eq', 1)
  })

  it('Backspace at the start of the paragraph after an image deletes only the image, keeping the text intact', () => {
    cy.getEditor().then((editor) => {
      // Place the image between the two paragraphs.
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
      // Caret at the start of the paragraph that follows the image.
      editor.commands.focus(imagePos + (node?.nodeSize ?? 1) + 1)
    })
    cy.get('#editor .ProseMirror').realPress('Backspace')

    // Upstream joinBackward deletes a leaf atom before the cut, so one
    // Backspace removes the image through the standard edit pipeline; the
    // surrounding paragraphs stay untouched and the caret stays a text cursor
    // (no NodeSelection, no hover-controls involvement).
    cy.nodeCount('image').should('eq', 0)
    cy.get('#editor .ProseMirror p').first().should('have.text', 'hello world')
    cy.get('#editor .ProseMirror p').last().should('have.text', 'below')
    cy.getEditor().then((editor) => {
      const selection = editor.state.selection as {
        node?: { type: { name: string } }
        empty: boolean
      }
      expect(selection.node, 'caret selection, not a NodeSelection').to.eq(undefined)
      expect(selection.empty, 'empty cursor after the deletion').to.eq(true)
    })
  })
})

export {}
