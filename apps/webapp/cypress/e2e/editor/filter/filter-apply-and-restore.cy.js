/* eslint-disable no-undef */
import { heading, paragraph, section } from '../../../fixtures/docMaker'

describe('Document filter (desktop)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'filter-desktop', persist: true })
    cy.createDocument({
      sections: [
        section('Filter Doc', [
          heading(2, 'Apple', [paragraph('apple pie body')]),
          heading(2, 'Banana', [paragraph('banana split body')])
        ])
      ]
    })
    cy.wait(500)
    cy.waitForToc()
  })

  it('does not crash when the query contains regex metacharacters', () => {
    cy.get('[aria-label="Filter Document"]').first().click({ force: true })
    // A lone "(" / "[" used to construct `new RegExp(userInput)` and throw;
    // with no ErrorBoundary that throw would surface as an uncaught exception
    // and fail this test. Panel still mounted => substring match, no crash.
    cy.get('#filterSearchBox').type('(')
    cy.get('#filterSearchBox').type('a)[')
    cy.get('#filterSearchBox').should('exist')
    cy.get('[data-testid="filter-match-count"]').should('exist')
  })

  it('folds non-matching sections on apply and restores them on clear, without a full reload', () => {
    cy.window().then((w) => {
      w.__noReload = true
    })

    cy.get('[aria-label="Filter Document"]').first().click({ force: true })
    cy.get('#filterSearchBox').type('apple{enter}')

    cy.location('pathname').should('include', 'apple') // path-segment URL model
    cy.get('.heading-fold-hidden', { timeout: 8000 }).should('exist')
    cy.contains('.docy_editor .tiptap.ProseMirror', 'banana split body').should('not.be.visible')
    cy.window().its('__noReload').should('eq', true) // SPA push, never a full reload
    cy.get('[data-testid="filter-active-indicator"]').should('exist') // toolbar shows active state

    // Reset restores the folded section in place (the chip-row clear-all).
    cy.get('[aria-label="Filter Document"]').first().click({ force: true })
    cy.contains('button', 'Reset').click({ force: true })
    cy.contains('.docy_editor .tiptap.ProseMirror', 'banana split body').should('be.visible')
    cy.get('[data-testid="filter-active-indicator"]').should('not.exist') // indicator cleared
    cy.window().its('__noReload').should('eq', true)
  })
})
