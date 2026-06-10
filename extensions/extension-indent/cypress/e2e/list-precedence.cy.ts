/// <reference types="cypress" />

// List sink/lift always wins over literal indent — including when literal indent is
// disabled entirely via ?contexts=none.

describe('list precedence over literal indent', () => {
  // doc.textContent is separator-free, so equality proves no literal spaces were inserted.
  it('Shift-Tab lifts a nested list item without touching its text', () => {
    cy.visitPlayground()
    cy.setEditorContent('<ul><li><p>One</p><ul><li><p>Two</p></li></ul></li></ul>')
    cy.get('#editor ul ul').should('exist')
    cy.setCaretInText('Two', 0)
    cy.pressKey('Tab', { shift: true })
    cy.get('#editor ul ul').should('not.exist')
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('OneTwo'))
  })

  it('Tab on the first top-level item inserts no literal spaces and keeps the list valid', () => {
    cy.visitPlayground()
    cy.setEditorContent('<ul><li><p>One</p></li></ul>')
    cy.setCaretInText('One', 0)
    cy.pressKey('Tab')
    cy.get('#editor ul li').should('have.length', 1)
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('One'))
  })

  it('Tab still sinks a nested-able list when literal indent is disabled (?contexts=none)', () => {
    cy.visitPlayground('?contexts=none')
    cy.setEditorContent('<ul><li><p>One</p></li><li><p>Two</p></li></ul>')
    cy.setCaretInText('Two', 0)
    cy.pressKey('Tab')
    cy.get('#editor ul ul').should('exist')
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('OneTwo'))
    cy.pressKey('Tab', { shift: true })
    cy.get('#editor ul ul').should('not.exist')
  })
})

export {}
