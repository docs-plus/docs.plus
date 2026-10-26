/**
 * Needs the whole local stack up (`make dev-local`) with real Auth. REST needs
 * MEDIA_COOKIE_SECRET (32+ chars), or the media session answers 503.
 * Run: env -u ELECTRON_RUN_AS_NODE bunx cypress run --config
 * baseUrl=http://localhost:3000 --spec cypress/e2e/auth/sign-out-cleanup.cy.ts
 */
import { AUTH_COOKIE_PATTERN, ensureLocalUser, signInLocalUser } from '../../support/authSession'

const EMAIL = 'e2e-sign-out@example.test'
const PASSWORD = 'e2e-sign-out-password'
const MEDIA_COOKIE = 'dp_media'

// Dexie stores version(1) as IndexedDB version 10, with this one table.
const DRAFTS_DB = 'chatApp'
const DRAFTS_DB_VERSION = 10
const DRAFTS_STORE = 'composer'

const openDrafts = (win: Window) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = win.indexedDB.open(DRAFTS_DB, DRAFTS_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (db.objectStoreNames.contains(DRAFTS_STORE)) return
      const store = db.createObjectStore(DRAFTS_STORE, { keyPath: ['workspaceId', 'roomId'] })
      for (const index of ['workspaceId', 'roomId', 'updatedAt']) store.createIndex(index, index)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

// Plain promises, so an intercept handler can read the drafts too.
const runInDrafts = <T>(
  win: Window,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) =>
  openDrafts(win).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(DRAFTS_STORE, mode).objectStore(DRAFTS_STORE))
        request.onsuccess = () => {
          db.close()
          resolve(request.result)
        }
        request.onerror = () => reject(request.error)
      })
  )

const inDrafts = <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) =>
  cy.window().then((win) => runInDrafts(win, mode, run))

const seedDraft = () =>
  inDrafts('readwrite', (store) =>
    store.put({
      workspaceId: 'e2e-sign-out-doc',
      roomId: 'e2e-sign-out-room',
      state: { text: 'unsent draft' },
      updatedAt: Date.now()
    })
  )
const countDrafts = () => inDrafts('readonly', (store) => store.count())

const cookieNames = () => cy.getAllCookies().then((cookies) => cookies.map(({ name }) => name))

describe('sign-out cleanup (full stack)', () => {
  const slug = `e2e-sign-out-${Date.now()}`

  beforeEach(() => {
    cy.viewport(1280, 800)
    ensureLocalUser(EMAIL, PASSWORD)
    signInLocalUser(EMAIL, PASSWORD)
    cy.intercept('POST', '**/plugins/hypermultimedia/session').as('mediaSession')
    cy.visit(`/${slug}`)
    // The signed-in session trades its token for the HttpOnly media cookie.
    cy.wait('@mediaSession').its('response.statusCode').should('eq', 204)
    cy.get('button[aria-label="Profile"]', { timeout: 40000 }).should('be.visible')
    seedDraft()
    // Preconditions, so the cleanup checks below cannot pass on an empty browser.
    cookieNames().should('include', MEDIA_COOKIE)
    cookieNames().should(
      (names) => expect(names.some((n) => AUTH_COOKIE_PATTERN.test(n))).to.be.true
    )
    countDrafts().should('eq', 1)
  })

  it('sign-out from Settings removes the session, the media cookie and the drafts', () => {
    // Cleanup must wait for signOut(), so a failed sign-out keeps the media cookie and drafts.
    // The end state cannot show that order, so record what is left when Auth gets the call.
    const order: string[] = []
    let draftsAtLogout: number | undefined
    cy.window().then((win) => {
      ;(win as Window & { __beforeSignOut?: boolean }).__beforeSignOut = true
      cy.intercept({ method: 'POST', url: /\/auth\/v1\/logout/ }, (req) =>
        runInDrafts(win, 'readonly', (store) => store.count()).then((count) => {
          draftsAtLogout = count
          order.push('logout')
          req.continue()
        })
      )
      cy.intercept({ method: 'DELETE', url: /\/plugins\/hypermultimedia\/session/ }, () => {
        order.push('media')
      })
    })
    cy.get('button[aria-label="Profile"]').click()
    cy.contains('button', 'Sign out').click()
    cy.get('[role="alertdialog"]').contains('button', 'Sign out').click()

    // SIGNED_OUT paints "Sign in" before cleanup ends, so wait for the reload instead.
    // useSignOut reloads the page only once it has cleaned up.
    cy.window({ timeout: 40000 }).should('not.have.property', '__beforeSignOut')
    cy.contains('button', 'Sign in', { timeout: 40000 }).should('be.visible')
    cy.wrap(null).should(() => {
      // SIGNED_OUT may send a second media delete; only the first two count.
      expect(order.slice(0, 2), 'Auth sign-out comes before the media delete').to.deep.equal([
        'logout',
        'media'
      ])
      expect(draftsAtLogout, 'drafts still there when Auth signs out').to.equal(1)
    })
    cookieNames().should((names) => {
      expect(names).not.to.include(MEDIA_COOKIE)
      expect(names.filter((n) => AUTH_COOKIE_PATTERN.test(n))).to.have.length(0)
    })
    countDrafts().should('eq', 0)
  })
})
