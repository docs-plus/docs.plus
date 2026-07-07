/// <reference types="cypress" />

import type { Editor } from '@tiptap/core'

describe('editor destroy with media controls open', () => {
  it('tears down all media controls, survives later keypresses, and re-inits on the same element', () => {
    cy.visitPlayground()
    cy.insertSizedImage(300, 200)
    cy.activateImageGripper()
    cy.get('#editor .hypermultimedia--image__content .media-toolbar').should('exist')

    cy.window().then((win) => {
      win._editor.destroy()
      expect(win.document.querySelector('.media-toolbar'), 'toolbar removed').to.be.null
      expect(
        win.document.querySelector('.hypermultimedia__resize-gripper--active'),
        'active gripper removed'
      ).to.be.null
      expect(
        win.document.querySelector('.hypermultimedia__resize-gripper--dragging'),
        'no dragging gripper'
      ).to.be.null
      expect(
        win.document.documentElement.classList.contains('hypermultimedia--resize-dragging'),
        'no document drag class'
      ).to.be.false
    })

    // Leaked document-level listeners on the dead editor would throw here
    // (Cypress fails the test on any uncaught exception).
    cy.get('body').realPress('Backspace')
    cy.get('body').realPress('Delete')

    cy.window().then((win) => {
      const old = win._editor
      const EditorCtor = old.constructor as new (options: {
        element: Element
        extensions: unknown[]
        content: string
      }) => Editor
      win._editor = new EditorCtor({
        element: old.options.element as Element,
        extensions: old.options.extensions,
        content: '<p>fresh</p>'
      })
    })

    cy.get('#editor .ProseMirror').should('contain.text', 'fresh')
    cy.insertSizedImage(200, 150)
    cy.nodeCount('image').should('eq', 1)
    cy.activateImageGripper()
    cy.get('#editor .hypermultimedia--image__content .media-toolbar').should('exist')
  })
})

export {}
