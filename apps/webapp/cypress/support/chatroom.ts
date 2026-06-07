/// <reference types="cypress" />

declare global {
  interface Window {
    __chatTestApi?: {
      scrollToItem: (
        id: string,
        align?: 'start' | 'center' | 'end',
        behavior?: 'instant' | 'smooth'
      ) => void
      currentTailSeq: () => number | null
      lastSeenSeq: () => number | null
      jumpToPresent: () => void
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      waitForMessage(key: string): Chainable<JQuery<HTMLElement>>
      scrollToMessageViaApi(id: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('waitForMessage', (key: string) =>
  cy.get(`[data-key="${key}"]`, { timeout: 10_000 }).should('be.visible')
)

Cypress.Commands.add('scrollToMessageViaApi', (id: string) =>
  cy.window().then((win) => {
    if (!win.__chatTestApi) {
      throw new Error('__chatTestApi missing — set NEXT_PUBLIC_E2E=true')
    }
    win.__chatTestApi.scrollToItem(id, 'center', 'instant')
  })
)

export {}
