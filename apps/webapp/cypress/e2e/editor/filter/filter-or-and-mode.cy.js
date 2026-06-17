/* eslint-disable no-undef */
import { heading, paragraph, section } from '../../../fixtures/docMaker'

describe('Document filter OR/AND mode', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'filter-mode', persist: true })
    // Veggies body has BOTH apple + carrot; Fruit body has only apple.
    cy.createDocument({
      sections: [
        section('Mode Doc', [
          heading(2, 'Fruit', [paragraph('apple pie body')]),
          heading(2, 'Veggies', [paragraph('apple carrot body')])
        ])
      ]
    })
    cy.wait(500)
    cy.waitForToc()
  })

  it('OR matches any term; AND narrows to all terms; mode persists in the URL', () => {
    cy.window().then((w) => {
      w.__noReload = true
    })

    // Apply two terms as two path segments.
    cy.get('[aria-label="Filter Document"]').first().click({ force: true })
    cy.get('#filterSearchBox').type('apple{enter}')
    cy.get('[aria-label="Filter Document"]').first().click({ force: true })
    cy.get('#filterSearchBox').type('carrot{enter}')

    // Default OR: both Fruit (apple) and Veggies (apple+carrot) bodies visible.
    cy.contains('.docy_editor .tiptap.ProseMirror', 'apple pie body').should('be.visible')
    cy.contains('.docy_editor .tiptap.ProseMirror', 'apple carrot body').should('be.visible')

    // Switch to AND via the real control (shown once 2+ filters are active).
    cy.get('[aria-label="Filter Document"]').first().click({ force: true })
    cy.get('#filter-mode-and').click({ force: true })
    cy.location('search').should('include', 'mode=and')

    // AND: only Veggies (has both) stays; Fruit (apple only) folds away.
    cy.get('.heading-fold-hidden', { timeout: 8000 }).should('exist')
    cy.contains('.docy_editor .tiptap.ProseMirror', 'apple carrot body').should('be.visible')
    cy.contains('.docy_editor .tiptap.ProseMirror', 'apple pie body').should('not.be.visible')
    cy.window().its('__noReload').should('eq', true) // mode change was SPA push
  })
})
