/**
 * Needs the whole local stack up (`make dev-local`) and its Mailpit. Real Auth sends
 * the link. Local Auth allows two emails an hour (`email_sent = 2`), so space runs.
 * Run: env -u ELECTRON_RUN_AS_NODE bunx cypress run --config
 * baseUrl=http://localhost:3000 --spec cypress/e2e/auth/email-link-sign-in.cy.ts
 */
const MAILPIT = Cypress.expose('MAILPIT_URL') ?? 'http://127.0.0.1:54324'
// Validate looks up MX records, and `.test` has none. Local Auth mails Mailpit only.
const EMAIL = 'e2e-email-link@example.com'

type MailpitList = { messages: { ID: string; To: { Address: string }[] }[] }
type MailpitMessage = { HTML: string; Text: string }

const VERIFY_LINK = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/

/** Polls Mailpit until the sign-in mail for `email` lands, then returns its link. */
const readSignInLink = (email: string, attempt = 0): Cypress.Chainable<string> =>
  cy.request<MailpitList>(`${MAILPIT}/api/v1/messages`).then(({ body }) => {
    const mail = body.messages.find((m) => m.To.some(({ Address }) => Address === email))
    if (!mail) {
      if (attempt >= 20) throw new Error(`No sign-in mail for ${email} in Mailpit`)
      cy.wait(500)
      return readSignInLink(email, attempt + 1)
    }
    return cy.request<MailpitMessage>(`${MAILPIT}/api/v1/message/${mail.ID}`).then(({ body }) => {
      const link = `${body.Text}\n${body.HTML}`.match(VERIFY_LINK)?.[0]
      if (!link) throw new Error('The sign-in mail holds no verify link')
      return link.replace(/&amp;/g, '&')
    })
  })

describe('email-link sign-in (full stack)', () => {
  const slug = `e2e-email-link-${Date.now()}`

  beforeEach(() => {
    cy.viewport(1280, 800)
    cy.request('DELETE', `${MAILPIT}/api/v1/messages`)
  })

  it('returns to the pad signed in and opens the chat its link names', () => {
    // A live heading id, so the return link names a chat that can open.
    cy.visit(`/${slug}`)
    cy.get('.tiptap__editor [data-toc-id]', { timeout: 40000 })
      .first()
      .invoke('attr', 'data-toc-id')
      .then((id) => {
        const headingId = String(id)
        cy.visit(`/${slug}?open_heading_chat=${headingId}`)
        cy.contains('button', 'Sign in', { timeout: 40000 }).click()
        cy.get('input[type="email"]').type(EMAIL)
        cy.contains('button', 'Send magic link').click()
        cy.contains('Check your email', { timeout: 20000 }).should('be.visible')

        // Auth verifies the token and redirects to the return path. The browser then
        // finishes the sign-in on the app origin, with the code verifier it stored.
        readSignInLink(EMAIL).then((link) =>
          cy.request({ url: link, followRedirect: false }).then(({ status, headers }) => {
            expect(status, 'Auth answers the link with a redirect').to.be.within(300, 399)
            const location = new URL(String(headers.location))
            expect(location.pathname, 'Auth returns to the pad').to.equal(`/${slug}`)
            expect(
              location.searchParams.get('open_heading_chat'),
              'Auth keeps the chat link'
            ).to.equal(headingId)
            cy.visit(location.href)
          })
        )

        cy.get('button[aria-label="Profile"]', { timeout: 40000 }).should('be.visible')
        cy.location('pathname').should('eq', `/${slug}`)
        // The draft lives in the local mirror; a lost id would fail here, not below.
        cy.get(`.tiptap__editor [data-toc-id="${headingId}"]`).should('exist')
        // An open chat rewrites the query, so check the docked chat, not the URL.
        cy.get('[role="region"][aria-label^="Chat"]', { timeout: 20000 }).should('be.visible')
      })
  })
})
