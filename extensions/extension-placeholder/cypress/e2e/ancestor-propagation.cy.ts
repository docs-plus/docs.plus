/// <reference types="cypress" />

// The depth walk decorates empty wrapper ancestors (empty blockquote / list item)
// with is-empty, but data-placeholder stays on the inner empty node only.

describe('placeholder — ancestor propagation', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('decorates the empty paragraph and its empty blockquote wrapper', () => {
    cy.setEditorContent('<blockquote><p></p></blockquote>')
    cy.caretInEmptyTextblock()
    cy.get('#editor blockquote.is-empty').should('exist')
    cy.get('#editor blockquote p[data-placeholder]').should('exist')
    cy.get('#editor blockquote').should('not.have.attr', 'data-placeholder')
  })

  it('decorates the empty paragraph and its empty list item', () => {
    cy.setEditorContent('<ul><li><p></p></li></ul>')
    cy.caretInEmptyTextblock()
    cy.get('#editor li.is-empty').should('exist')
    cy.get('#editor li p[data-placeholder]').should('exist')
  })

  it('does not decorate a filled sibling list item', () => {
    cy.setEditorContent('<ul><li><p>x</p></li><li><p></p></li></ul>')
    cy.caretInEmptyTextblock()
    cy.get('#editor li').eq(1).should('have.class', 'is-empty')
    cy.get('#editor li').eq(0).should('not.have.class', 'is-empty')
  })
})

export {}
