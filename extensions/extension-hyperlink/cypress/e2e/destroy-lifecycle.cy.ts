/// <reference types="cypress" />

/**
 * Editor-destroy lifecycle for the popover singleton: destroying the
 * editor that opened a popover tears it down (no leaked body-appended
 * DOM), while destroying an unrelated editor must leave it untouched.
 */

const PREVIEW = '.hyperlink-preview-popover'
const DOC = '<p>Visit <a href="https://example.com">Example</a> now.</p>'

describe('destroy lifecycle — popover ownership', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent(DOC)
  })

  it('destroying the editor closes its open popover and leaves no popover DOM in the body', () => {
    cy.get('#editor a').click()
    cy.get('.floating-popover').should('have.class', 'visible')
    cy.window().then((win) => {
      win._editor.destroy()
    })
    cy.get('.floating-popover').should('not.exist')
    cy.get(PREVIEW).should('not.exist')
  })

  it('destroying an unrelated editor leaves the open popover mounted (ownership)', () => {
    cy.get('#editor a').click()
    cy.get(PREVIEW).should('be.visible')

    // Scratch editor wired with the same extension set (including this
    // package's Hyperlink), so its destroy runs the mark's onDestroy hook
    // — which must only close popovers the scratch editor itself opened.
    cy.window().then((win) => {
      const host = win.document.createElement('div')
      win.document.body.appendChild(host)
      const EditorCtor = win._editor.constructor as unknown as new (options: {
        element: HTMLElement
        extensions: unknown
        content: string
      }) => { destroy: () => void }
      const scratch = new EditorCtor({
        element: host,
        extensions: win._editor.options.extensions,
        content: '<p>scratch</p>'
      })
      scratch.destroy()
      host.remove()
    })

    cy.get(PREVIEW).should('be.visible')
    cy.get('.floating-popover').should('have.class', 'visible')
  })
})

export {}
