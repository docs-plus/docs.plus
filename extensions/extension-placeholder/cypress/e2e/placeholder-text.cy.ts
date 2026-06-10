/// <reference types="cypress" />

// Option resolution: the function form receives parentName; an empty string emits
// no decoration; custom class options are applied.

describe('placeholder — text & options', () => {
  it('function placeholder resolves parentName (doc vs listItem)', () => {
    cy.visitPlayground('?placeholder=fn')
    cy.get('#editor [data-placeholder]').should('have.attr', 'data-placeholder', 'Empty doc')
    cy.setEditorContent('<ul><li><p></p></li></ul>')
    cy.caretInEmptyTextblock()
    cy.get('#editor li [data-placeholder]').should('have.attr', 'data-placeholder', 'List item')
  })

  it('emits no decoration for an empty placeholder string', () => {
    cy.visitPlayground('?placeholder=empty')
    cy.get('#editor .is-empty').should('not.exist')
    cy.get('#editor [data-placeholder]').should('not.exist')
  })

  it('applies custom empty classes', () => {
    cy.visitPlayground('?nodeClass=custom')
    cy.get('#editor .ph-node.ph-doc').should('exist')
    cy.get('#editor .ph-node[data-placeholder]').should('exist')
  })
})

export {}
