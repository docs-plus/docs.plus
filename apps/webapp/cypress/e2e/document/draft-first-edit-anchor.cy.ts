/**
 * Full-stack E2E for the draft first-edit anchor.
 *
 * Requires the whole local stack running (`make dev-local`): webapp :3001, WS,
 * REST, Supabase, and the Prisma pg (docsy-postgres-local). It is NOT a mocked
 * spec like the chatroom suite — the whole point is IndexedDB survival across a
 * real browser reload, which cannot be faked. DB assertions run via the
 * `queryDocBySlug` / `waitForDocBySlug` / `queryDocVersionCount` / `deleteDocBySlug`
 * cy.tasks (see cypress.config.ts). Anon is sufficient. Local-only: no CI lane
 * runs e2e/document/**, so run it deliberately with the stack up.
 */

const BASE = 'http://localhost:3001'
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
      cy.task('queryDocBySlug', slug)
        .its('documentId')
        .should('eq', documentId) // same id -> same IndexedDB key + WS room
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
})
