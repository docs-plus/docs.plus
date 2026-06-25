/* eslint-disable no-undef */
import { heading, paragraph, section } from '../../../fixtures/docMaker'

describe('Document filter (mobile sheet)', () => {
  beforeEach(() => {
    cy.viewport('iphone-x')
    cy.visitEditor({ docName: 'filter-mobile', persist: true })
    cy.createDocument({
      sections: [
        section('Filter Doc', [
          heading(2, 'Apple', [paragraph('apple pie body')]),
          heading(2, 'Banana', [paragraph('banana split body')])
        ])
      ]
    })
    cy.wait(500)
  })

  it('opens the unified filter sheet, shows a live match count, and applies in place', () => {
    cy.window().then((w) => {
      w.__noReload = true
    })

    cy.get('[aria-label="Open filters"]').click({ force: true })
    cy.get('[data-testid="filter-sheet-apply"]').should('be.visible')

    // Counter is driven by real headings, not the old dead `.title` selector.
    cy.get('#filterSearchBox').type('apple')
    cy.get('[data-testid="filter-match-count"]').should('contain', 'section')

    cy.get('[data-testid="filter-sheet-apply"]').click({ force: true })
    cy.location('pathname').should('include', 'apple')
    cy.get('.heading-fold-hidden', { timeout: 8000 }).should('exist')
    cy.get('[data-testid="filter-sheet-apply"]').should('not.exist')
    cy.get('[aria-label="Remove filter: apple"]').should('exist')
    cy.window().its('__noReload').should('eq', true) // SPA push, no full reload
  })
})
