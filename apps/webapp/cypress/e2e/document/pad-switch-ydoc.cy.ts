/**
 * Needs the whole local stack up (`make dev-local`): webapp, WS, REST, Supabase,
 * docsy-postgres-local. Deliberately unmocked: a client-side pad switch keeps
 * `DocumentPage` mounted, so only a real provider and IndexedDB show a Y.Doc leak.
 * Local-only: no CI lane runs e2e/document/**, so run it with the stack up.
 */

// `--config baseUrl=http://localhost:3000` points the spec at another webapp port.
const BASE = Cypress.config('baseUrl') ?? 'http://localhost:3001'
const pad = () => cy.get('.ProseMirror[contenteditable="true"]', { timeout: 40000 })
type DocRow = { documentId: string; ownerId: string | null } | null
const freshSlug = () => `e2e-switch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const rand = () => Math.random().toString(36).slice(2, 10)

// The first content persist lands about 10 s after the edit, so poll the head.
const waitForHeadText = (documentId: string, marker: string, tries = 40): Cypress.Chainable => {
  return cy.task<string | null>('queryDocHeadText', documentId).then((text) => {
    if (text?.includes(marker)) return
    if (tries <= 0) throw new Error(`head of ${documentId} never held "${marker}"`)
    cy.wait(1000)
    waitForHeadText(documentId, marker, tries - 1)
  })
}

// Types a marker into a fresh pad and waits until the server head holds it.
const seedPad = (slug: string, marker: string): Cypress.Chainable<string> => {
  cy.visit(`${BASE}/${slug}`)
  pad().should('be.visible').click().realType(marker)
  return cy.task<DocRow>('waitForDocBySlug', slug).then((row) => {
    expect(row, `anchor row for ${slug}`).to.not.be.null
    const documentId = row!.documentId
    waitForHeadText(documentId, marker)
    return cy.wrap(documentId)
  })
}

describe('pad switch keeps each Y.Doc in its own room (full stack)', () => {
  let slugA: string
  let slugB: string

  beforeEach(() => {
    slugA = freshSlug()
    slugB = freshSlug()
    cy.viewport(1280, 800)
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slugA)
    cy.task('deleteDocBySlug', slugB)
  })

  it('never syncs pad A text into pad B after a router switch', () => {
    const markerA = `AAA-${rand()}`
    const markerB = `BBB-${rand()}`

    seedPad(slugB, markerB).then((documentIdB) => {
      seedPad(slugA, markerA)

      // Router push, not cy.visit: the page must stay mounted across the switch.
      cy.window().its('next.router').invoke('push', `/${slugB}`)
      cy.location('pathname', { timeout: 20000 }).should('eq', `/${slugB}`)
      pad().should('contain.text', markerB)
      cy.wait(2000) // give a leaked sync time to merge before the negative check
      pad().should('not.contain.text', markerA)

      // A reload reads the IndexedDB mirror first, so it also catches a leak there.
      cy.reload()
      pad().should('contain.text', markerB)
      pad().should('not.contain.text', markerA)

      // Past the persist debounce, so a leaked sync would have reached the head.
      cy.wait(13000)
      cy.task<string | null>('queryDocHeadText', documentIdB).then((head) => {
        expect(head, 'pad B head').to.contain(markerB)
        expect(head, 'pad B head').to.not.contain(markerA)
      })
    })
  })
})
