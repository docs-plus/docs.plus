/**
 * Needs the whole local stack up (`make dev-local`): webapp, WS, REST, worker,
 * Supabase, docsy-postgres-local. Deliberately unmocked: the head row in Postgres
 * is the proof that an edit was saved. Local-only: no CI lane runs e2e/document/**.
 */

// `--config baseUrl=http://localhost:3000` points the spec at another webapp port.
const BASE = Cypress.config('baseUrl') ?? 'http://localhost:3001'
const pad = () => cy.get('.ProseMirror[contenteditable="true"]', { timeout: 40000 })
type DocRow = { documentId: string; ownerId: string | null } | null
const freshSlug = () => `e2e-saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const rand = () => Math.random().toString(36).slice(2, 10)
const PROVIDER_URL = 'ws://localhost:4001' // NEXT_PUBLIC_PROVIDER_URL under `make dev-local`

// A save lands after the 10 s debounce or at the close flush, so poll the head.
const waitForHeadText = (documentId: string, marker: string, tries = 30): Cypress.Chainable => {
  return cy.task<string | null>('queryDocHeadText', documentId).then((text) => {
    if (text?.includes(marker)) return
    if (tries <= 0) throw new Error(`head of ${documentId} never held "${marker}"`)
    cy.wait(1000)
    waitForHeadText(documentId, marker, tries - 1)
  })
}

// Queued through cy.then, so it runs in command order and Cypress waits for it.
// CDP needs all four fields; -1 turns throttling off.
const setOffline = (offline: boolean) =>
  cy.then(async () => {
    await Cypress.automation('remote:debugger:protocol', { command: 'Network.enable' })
    await Cypress.automation('remote:debugger:protocol', {
      command: 'Network.emulateNetworkConditions',
      params: { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }
    })
  })

// CDP offline blocks new handshakes but may leave an open socket alive. The page's
// sockets are recorded so the test can close the collab one by hand.
let pageSockets: WebSocket[] = []
const recordSockets = (win: Cypress.AUTWindow) => {
  pageSockets = []
  const sockets = pageSockets
  win.WebSocket = class extends win.WebSocket {
    constructor(...args: ConstructorParameters<typeof WebSocket>) {
      super(...args)
      sockets.push(this)
    }
  }
}

// A pad with a stored head, so the edits under test merge onto saved versions.
// The head check proves a stored version exists: it reads text only from a Documents row.
const seedSavedPad = (
  slug: string,
  onBeforeLoad?: (win: Cypress.AUTWindow) => void
): Cypress.Chainable<string> => {
  const seed = `seed-${rand()}`
  cy.visit(`${BASE}/${slug}`, { onBeforeLoad })
  pad().should('be.visible').click().realType(seed)
  return cy.task<DocRow>('waitForDocBySlug', slug).then((row) => {
    expect(row, `anchor row for ${slug}`).to.not.be.null
    const documentId = row!.documentId
    waitForHeadText(documentId, seed)
    return cy.wrap(documentId)
  })
}

describe('edits on a saved pad reach the Postgres head (full stack)', () => {
  let slug: string

  beforeEach(() => {
    slug = freshSlug()
    cy.viewport(1280, 800)
  })

  afterEach(() => {
    // A stale offline flag breaks every later spec in this browser.
    if (Cypress.isBrowser({ family: 'chromium' })) setOffline(false)
    cy.task('deleteDocBySlug', slug)
  })

  it('keeps an edit made just before a reload', () => {
    seedSavedPad(slug).then((documentId) => {
      const token = `reload-${rand()}`
      pad().click().realType(token)
      cy.reload() // well inside the 10 s debounce

      pad().should('contain.text', token)
      waitForHeadText(documentId, token)
    })
  })

  it('saves an offline edit once the browser is back online', function () {
    if (!Cypress.isBrowser({ family: 'chromium' })) this.skip() // CDP only

    seedSavedPad(slug, recordSockets).then((documentId) => {
      const token = `offline-${rand()}`
      setOffline(true)
      // Never the Next HMR socket: dropping it can reload the page.
      cy.then(() => {
        const collab = pageSockets.filter((ws) => ws.url.startsWith(PROVIDER_URL))
        expect(collab, 'collab sockets').to.have.length.greaterThan(0)
        collab.forEach((ws) => ws.close())
      })
      cy.get('[role="status"][aria-label="Offline"]', { timeout: 10000 }).should('exist')
      pad().click().realType(token)
      pad().should('contain.text', token)

      // Past the debounce. A live socket would have saved the edit by now, and the
      // rest of this test would prove nothing.
      cy.wait(13000)
      cy.task<string | null>('queryDocHeadText', documentId).should('not.contain', token)

      setOffline(false)
      waitForHeadText(documentId, token)
      cy.reload()
      pad().should('contain.text', token)
    })
  })
})
