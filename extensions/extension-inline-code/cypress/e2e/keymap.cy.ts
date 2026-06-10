/// <reference types="cypress" />

// Mod-e through a real keydown (prosemirror-keymap path). Mod resolves to Meta
// on mac and Ctrl elsewhere, so pick the modifier from the host platform.

const mod = Cypress.platform === 'darwin' ? { metaKey: true } : { ctrlKey: true }

describe('inline code — keyboard shortcut', () => {
  it('Mod-e toggles inline code on a selection', () => {
    cy.visitPlayground()
    cy.setEditorContent('<p>hello world</p>')
    cy.selectText('hello')
    cy.pressKey('e', mod)
    cy.get('#editor code').should('have.text', 'hello')
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
    cy.pressKey('e', mod)
    cy.get('#editor code').should('not.exist')
  })

  it('Mod-e yields inlineCode, not StarterKit code, when both marks are registered', () => {
    cy.visitPlayground('?starterkitCode=on')
    cy.setEditorContent('<p>hello</p>')
    cy.selectText('hello')
    cy.pressKey('e', mod)
    cy.getEditor().should((e) => {
      expect(e.isActive('inlineCode')).to.equal(true)
      expect(e.isActive('code')).to.equal(false)
    })
  })
})

export {}
