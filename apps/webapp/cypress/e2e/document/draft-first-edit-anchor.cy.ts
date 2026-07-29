/**
 * Needs the whole local stack up (`make dev-local`): webapp :3001, WS, REST,
 * Supabase, docsy-postgres-local. Deliberately unmocked — the point is IndexedDB
 * survival across a real browser reload, which cannot be faked. Local-only: no
 * CI lane runs e2e/document/**, so run it deliberately with the stack up.
 */

const BASE = 'http://localhost:3001'
const REST = 'http://localhost:4000/api' // hocuspocus REST under `make dev-local`
const pad = () => cy.get('.ProseMirror[contenteditable="true"]', { timeout: 40000 })
const freshSlug = () => `e2e-draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

describe('draft first-edit anchor (full stack)', () => {
  let slug: string

  beforeEach(() => {
    slug = freshSlug()
    cy.viewport(1280, 800) // desktop: no autoFocus, so an un-touched doc stays isDraft
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('survives a reload made before the content debounce', () => {
    const marker = `keep-${slug}`
    cy.visit(`${BASE}/${slug}`)
    pad().should('be.visible').click().realType(marker)

    // Gate the reload on the anchor row landing — that write IS the mechanism
    // under test; a fixed wait would race the async onChange->DB create.
    cy.task('waitForDocBySlug', slug).then((row: { documentId: string } | null) => {
      expect(row, 'anchor row created on first edit').to.not.be.null
      const documentId = row!.documentId
      // Content is not server-persisted yet (10s debounce), so survival can only
      // come from the stable documentId + IndexedDB mirror — i.e. the anchor.
      cy.task('queryDocVersionCount', documentId).should('eq', 0)

      cy.reload()
      pad().should('contain.text', marker)
      cy.task('queryDocBySlug', slug).its('documentId').should('eq', documentId) // same id -> same IndexedDB key + WS room
    })
  })

  it('leaves no metadata row when opened but never edited (anti-empty-doc)', () => {
    cy.visit(`${BASE}/${slug}`)
    pad().should('be.visible')
    cy.wait(4000) // give any (wrongly-firing) anchor time to write
    cy.task('queryDocBySlug', slug).should('be.null')
  })

  it('keeps a renamed title through the first content persist (pins update:{})', () => {
    cy.visit(`${BASE}/${slug}`)
    pad().should('be.visible').click().realType('body text')
    cy.task('waitForDocBySlug', slug) // anchor landed

    // Rename via the DocTitle contentEditable (distinct from the .ProseMirror body).
    cy.get('[contenteditable]', { timeout: 40000 })
      .not('.ProseMirror')
      .first()
      .click()
      .type('{selectall}Renamed Doc Title{enter}') // Enter blurs -> PUT /documents/:id

    // Past the 10s debounce so the worker's isFirst metadata upsert runs. Pre-fix
    // its UPDATE branch reset title=slug; with update:{} the user title survives.
    cy.wait(13000)
    cy.reload()
    cy.contains('Renamed Doc Title', { timeout: 40000 }).should('exist')
  })

  it('anchors a titled draft under the URL slug before any body edit', () => {
    cy.visit(`${BASE}/${slug}`)
    pad().should('be.visible') // editor mounted; deliberately DO NOT edit the body

    // Rename via the DocTitle contentEditable (never the .ProseMirror body). A title
    // whose slug differs from the URL slug is what exposes the bug.
    cy.get('[contenteditable]', { timeout: 40000 })
      .not('.ProseMirror')
      .first()
      .click()
      .type('{selectall}Hello Anchor World{enter}') // Enter blurs -> PUT /documents/:id

    // queryDocBySlug looks up BY the URL slug, so a non-null row proves the row was
    // created under the URL slug, not slugify("Hello Anchor World"). Pre-fix this row
    // is absent -> reload mints a new id -> data loss.
    cy.task('waitForDocBySlug', slug).then((row: { documentId: string } | null) => {
      expect(row, 'titled draft anchored under URL slug').to.not.be.null
      const documentId = row!.documentId

      cy.reload()
      cy.task('queryDocBySlug', slug).its('documentId').should('eq', documentId)
      cy.contains('Hello Anchor World', { timeout: 40000 }).should('exist') // title survived reload
    })
  })

  it('anchors a draft when the workspace chatroom opens (no body edit)', () => {
    cy.visit(`${BASE}/${slug}`)
    pad().should('be.visible') // editable => provider synced (flip won't be dropped); DO NOT edit

    // Open the workspace chatroom from the TOC header — no body edit, no message sent.
    // Chat rows key on the documentId (=channel_id), so opening chat must anchor it.
    cy.get('[aria-label="Open chat"]', { timeout: 40000 }).first().click({ force: true })

    cy.task('waitForDocBySlug', slug).then((row: { documentId: string } | null) => {
      expect(row, 'chatroom-open anchored the draft').to.not.be.null
      const documentId = row!.documentId

      cy.reload()
      cy.task('queryDocBySlug', slug).its('documentId').should('eq', documentId) // stable channel_id
    })
  })

  // Pins the 2026-07-22/24 production failure: two people opening one new slug got
  // different random ids, so they joined different rooms and never saw each other.
  // The loser's text persisted under a suffixed slug no URL reaches. Two reads of
  // the draft endpoint returning one id is the property that prevents it.
  it('gives every first-open of one new slug the same documentId', () => {
    cy.request(`${REST}/documents/${slug}`).then((first) => {
      const documentId = first.body.data.documentId
      // Charset, not just length: lower(documentId) lands in workspaces.slug under a
      // CHECK that rejects `_`, so a base64url "simplification" passes a length test
      // and breaks in production.
      expect(documentId, 'draft id').to.match(/^[0-9a-zA-Z]{19}$/)

      cy.request(`${REST}/documents/${slug}`).then((second) => {
        expect(second.body.data.documentId, 'same slug -> same room').to.eq(documentId)
      })
      // A different slug must not share it, or one identity would serve two documents.
      cy.request(`${REST}/documents/${slug}-other`).then((other) => {
        expect(other.body.data.documentId).to.not.eq(documentId)
      })
    })
    cy.task('queryDocBySlug', slug).should('be.null') // reads alone still create no row
  })
})
