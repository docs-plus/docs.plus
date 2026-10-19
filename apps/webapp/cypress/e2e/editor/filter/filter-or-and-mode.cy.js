/* eslint-disable no-undef */
import { freshSlug, padParagraph, sectionsDoc, visitSeededPad } from './filter-shared'

describe('Document filter OR/AND mode', () => {
  let slug

  beforeEach(() => {
    slug = freshSlug('filter-mode')
    // Veggies body has BOTH apple + carrot; Fruit body has only apple.
    visitSeededPad(
      slug,
      sectionsDoc('Mode Doc', [
        ['Fruit', 'apple pie body'],
        ['Veggies', 'apple carrot body']
      ])
    )
    cy.waitForToc()
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('OR matches any term; AND narrows to all terms; mode persists in the URL', () => {
    cy.window().then((w) => {
      w.__noReload = true
    })

    // Apply two terms as two path segments. The desktop panel stays open after Enter,
    // so a second trigger click would close it.
    cy.get('[aria-label="Filter document"]').first().click({ force: true })
    cy.get('#filterSearchBox').type('apple{enter}')
    cy.location('pathname').should('match', /\/apple$/)
    cy.get('#filterSearchBox').type('carrot{enter}')
    cy.location('pathname').should('match', /\/apple\/carrot$/)

    // Default OR: both Fruit (apple) and Veggies (apple+carrot) bodies visible.
    padParagraph('apple pie body').should('be.visible')
    padParagraph('apple carrot body').should('be.visible')

    // Switch to AND via the real control (shown once 2+ filters are active).
    cy.get('#filter-mode-and').click({ force: true })
    cy.location('search').should('include', 'mode=and')

    // AND: only Veggies (has both) stays; Fruit (apple only) folds away.
    cy.get('.heading-fold-hidden', { timeout: 8000 }).should('exist')
    padParagraph('apple carrot body').should('be.visible')
    padParagraph('apple pie body').should('not.be.visible')
    cy.window().its('__noReload').should('eq', true) // mode change was SPA push
  })
})
