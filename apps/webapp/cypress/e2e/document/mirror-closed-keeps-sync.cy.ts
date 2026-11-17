/**
 * Needs the whole local stack up (`make dev-local`): webapp, WS, REST, Supabase,
 * docsy-postgres-local. Pins #751: a write to a closed offline copy threw inside the
 * Yjs 'update' emit and stopped the pad sending edits until the socket reconnected.
 * Local-only: no CI lane runs e2e/document/**, so run it with the stack up.
 */

import { freshSlug, pad, rand, seedPad, waitForHeadText } from '../../support/documentStack'

describe('a closed offline copy does not stop pad updates (full stack)', () => {
  let slug: string

  beforeEach(() => {
    slug = freshSlug('mirror-closed')
    cy.viewport(1280, 800)
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('still syncs an edit after the IndexedDB database is deleted', () => {
    const markerA = `AAA-${rand()}`
    const markerB = `BBB-${rand()}`

    seedPad(slug, markerA, 40).then((documentId) => {
      // The delete fires versionchange, and lib0 closes the open connection.
      cy.window().then(
        (win) =>
          new Cypress.Promise<void>((res) => {
            const r = win.indexedDB.deleteDatabase(documentId)
            r.onsuccess = r.onerror = r.onblocked = () => res()
          })
      )

      pad().click().realType(markerB)
      waitForHeadText(documentId, markerB, 40)
    })
  })
})
