/// <reference types="cypress" />

// Core lifecycle: the empty editor shows the placeholder, it clears on the first
// inserted character, and returns when the document is emptied again.

describe('placeholder — empty document', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('shows is-empty + is-editor-empty + data-placeholder on a fresh empty editor', () => {
    cy.get('#editor .is-empty.is-editor-empty').should('exist')
    cy.get('#editor [data-placeholder]').should(
      'have.attr',
      'data-placeholder',
      'Write something here'
    )
  })

  it('renders the placeholder text through ::before', () => {
    cy.get('#editor [data-placeholder]').then(($el) => {
      const el = $el[0]
      const content = el.ownerDocument.defaultView!.getComputedStyle(el, '::before').content
      expect(content).to.contain('Write something here')
    })
  })

  it('clears the placeholder on the first inserted character', () => {
    cy.get('#editor .is-empty').should('exist')
    cy.getEditor().then((e) => e.chain().focus().insertContent('a').run())
    cy.get('#editor .is-empty').should('not.exist')
    cy.get('#editor [data-placeholder]').should('not.exist')
  })

  it('returns the placeholder after the content is deleted', () => {
    cy.getEditor().then((e) => e.chain().focus().insertContent('a').run())
    cy.get('#editor .is-empty').should('not.exist')
    cy.getEditor().then((e) => e.chain().selectAll().deleteSelection().run())
    cy.get('#editor .is-empty.is-editor-empty').should('exist')
  })
})

export {}
