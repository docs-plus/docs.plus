/// <reference types="cypress" />

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

describe('paste undo', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('undo removes a pasted youtube embed and leaves no pending loading shell behind', () => {
    cy.get('#editor .ProseMirror').click()
    cy.pastePlainText(YOUTUBE_URL)
    cy.nodeCount('youtube').should('eq', 1)

    cy.getEditor().then((editor) => {
      editor.commands.undo()
    })
    cy.nodeCount('youtube').should('eq', 0)
    // The node view (and its loading shell) must go with the node — no orphans.
    cy.get('.hm-media-host[data-hm-loading="pending"]').should('not.exist')
  })

  it('undo removes a pasted image file in one step', () => {
    cy.get('#editor .ProseMirror').click()
    cy.pasteImageFile()
    // The host inserts asynchronously (editorFileUpload → blob probe load);
    // wait for the rendered img before counting — nodeCount does not retry.
    cy.get('#editor img').should('exist')
    cy.nodeCount('image').should('eq', 1)

    cy.getEditor().then((editor) => {
      editor.commands.undo()
    })
    cy.nodeCount('image').should('eq', 0)
    cy.get('#editor img').should('not.exist')
  })
})

export {}
