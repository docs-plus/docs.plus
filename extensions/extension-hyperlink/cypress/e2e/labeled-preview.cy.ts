describe('preview without a metadata service', () => {
  it('shows visible action labels and removes a link with the documented factory wrapper', () => {
    cy.viewport(375, 812)
    const metadataRequest = cy.spy().as('metadataRequest')
    cy.intercept('**/api/metadata*', metadataRequest)
    cy.visit('/?popover=labels')
    cy.window().should('have.property', '_editor')
    cy.setEditorContent('<p><a href="https://example.com">Example</a></p>')
    cy.get('#editor a').click()
    cy.getVisibleFloatingPopover()
      .find('.hyperlink-preview-popover')
      .should(($preview) => {
        const bounds = $preview[0].getBoundingClientRect()
        expect(bounds.left).to.be.at.least(0)
        expect(bounds.right).to.be.at.most(375)
      })
      .within(() => {
        for (const label of ['Copy link', 'Edit link', 'Remove link']) {
          cy.contains('button span', label).should('be.visible')
        }
        cy.contains('button', 'Remove link').click()
      })
    cy.get('#editor a').should('not.exist')
    cy.get('#editor p').should('have.text', 'Example')
    cy.get('@metadataRequest').should('not.have.been.called')
  })
})

export {}
