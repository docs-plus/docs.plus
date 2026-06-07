describe('Loom parseHTML src gate (S1)', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('rejects a hostile non-Loom iframe src on stored HTML', () => {
    cy.setEditorContent(
      '<div data-loom-video><iframe src="data:text/html,<h1>x</h1>"></iframe></div>'
    )
    cy.nodeCount('loom').should('eq', 1)
    cy.get('#editor iframe').should('have.attr', 'src', '')
  })
})

export {}
