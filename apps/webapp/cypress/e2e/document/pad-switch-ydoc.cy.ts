/**
 * Needs the whole local stack up (`make dev-local`): webapp, WS, REST, Supabase,
 * docsy-postgres-local. Deliberately unmocked: a client-side pad switch keeps
 * `DocumentPage` mounted, so only a real provider and IndexedDB show a Y.Doc leak.
 * Local-only: no CI lane runs e2e/document/**, so run it with the stack up.
 */

import { pad, rand, seedPad } from '../../support/documentStack'

const freshSlug = () => `e2e-switch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

    seedPad(slugB, markerB, 40).then((documentIdB) => {
      seedPad(slugA, markerA, 40)

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
