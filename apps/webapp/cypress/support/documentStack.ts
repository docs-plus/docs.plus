/// <reference types="cypress" />

// `--config baseUrl=http://localhost:3000` points a spec at another webapp port.
export const BASE = Cypress.config('baseUrl') ?? 'http://localhost:3001'
export const pad = () => cy.get('.ProseMirror[contenteditable="true"]', { timeout: 40000 })
export type DocRow = { documentId: string; ownerId: string | null } | null
export const rand = () => Math.random().toString(36).slice(2, 10)
export const freshSlug = (prefix: string) => `e2e-${prefix}-${Date.now()}-${rand()}`
// The 10 s server persist debounce plus slack.
export const PAST_PERSIST_DEBOUNCE_MS = 13000

// A save lands after the 10 s debounce or at the close flush, so poll the head.
export const waitForHeadText = (
  documentId: string,
  marker: string,
  tries: number
): Cypress.Chainable =>
  cy.task<string | null>('queryDocHeadText', documentId).then((text) => {
    if (text?.includes(marker)) return
    if (tries <= 0) throw new Error(`head of ${documentId} never held "${marker}"`)
    cy.wait(1000)
    waitForHeadText(documentId, marker, tries - 1)
  })

// Types a marker into a fresh pad and waits until the server head holds it.
export const seedPad = (
  slug: string,
  marker: string,
  tries: number,
  onBeforeLoad?: (win: Cypress.AUTWindow) => void
): Cypress.Chainable<string> => {
  cy.visit(`${BASE}/${slug}`, { onBeforeLoad })
  pad().should('be.visible').click().realType(marker)
  return cy.task<DocRow>('waitForDocBySlug', slug).then((row) => {
    expect(row, `anchor row for ${slug}`).to.not.be.null
    const documentId = row!.documentId
    waitForHeadText(documentId, marker, tries)
    return cy.wrap(documentId)
  })
}
