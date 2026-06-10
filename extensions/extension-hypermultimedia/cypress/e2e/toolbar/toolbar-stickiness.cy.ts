/// <reference types="cypress" />

describe('toolbar stickiness on scroll', () => {
  it('keeps the toolbar and the active gripper anchored to the image while the page scrolls', () => {
    cy.visitPlayground()
    cy.setEditorContent(`<p>top</p>${'<p>filler paragraph to force page overflow</p>'.repeat(40)}`)
    cy.getEditor().then((editor) => {
      editor.commands.focus('start')
    })
    cy.insertSizedImage(300, 200)
    cy.activateImageGripper()
    cy.get('#editor .hypermultimedia--image__content .media-toolbar').should('exist')

    cy.expectToolbarFollowsAnchor('#editor .media-toolbar', '#editor img')
    cy.expectToolbarFollowsAnchor('#editor .hypermultimedia__resize-gripper--active', '#editor img')
  })
})

export {}
