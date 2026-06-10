/// <reference types="cypress" />

describe('resize undo/redo', () => {
  it('undo reverts both the width attr and the rendered size; redo re-applies them', () => {
    cy.visitPlayground()
    cy.prepareImageForResize(200, 150)
    // PM history groups transactions landing within 500ms (newGroupDelay); settle so
    // the resize commit is its own undo step instead of merging with the insert.
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(600)
    cy.dragResizeClamp('right', 60)

    cy.nodeAttr('image', 'width').then((resized) => {
      const resizedWidth = Number(resized)
      expect(resizedWidth).to.be.greaterThan(200)
      cy.expectRenderedMediaSize('#editor img', 'width', resizedWidth)

      cy.getEditor().then((editor) => {
        editor.commands.undo()
      })
      cy.nodeCount('image').should('eq', 1)
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.eq(200)
      })
      cy.expectRenderedMediaSize('#editor img', 'width', 200)

      cy.getEditor().then((editor) => {
        editor.commands.redo()
      })
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.eq(resizedWidth)
      })
      cy.expectRenderedMediaSize('#editor img', 'width', resizedWidth)
    })
  })
})

export {}
