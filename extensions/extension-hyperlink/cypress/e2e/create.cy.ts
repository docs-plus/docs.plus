/// <reference types="cypress" />

const POPOVER = '.hyperlink-create-popover'
const INPUT = `${POPOVER} input[name="hyperlink-url"]`
const SUBMIT = `${POPOVER} button[type="submit"]`
const ERROR = `${POPOVER} .error-message`
const WRAPPER = `${POPOVER} .inputs-wrapper`

describe('createHyperlinkPopover — prebuilt create flow', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p>Select this target word to apply a link.</p>')
    cy.selectText('target')
  })

  describe('trigger + lifecycle', () => {
    it('opens on Mod+K', () => {
      cy.pressModK()
      cy.get(POPOVER).should('be.visible')
      cy.get(INPUT).should('be.focused')
    })

    it('starts with Apply disabled', () => {
      cy.pressModK()
      cy.get(SUBMIT).should('be.disabled')
    })

    it('enables Apply once the input has a value', () => {
      cy.pressModK()
      cy.get(INPUT).type('https://example.com')
      cy.get(SUBMIT).should('not.be.disabled')
    })

    it('dismisses on Escape without creating a link', () => {
      cy.pressModK()
      cy.get(INPUT).type('https://example.com').type('{esc}')
      cy.get(POPOVER).should('not.exist')
      cy.get('#editor a').should('not.exist')
    })

    it('dismisses on outside click without creating a link', () => {
      cy.pressModK()
      cy.get(INPUT).type('https://example.com')
      cy.get('body').click('topLeft')
      cy.get(POPOVER).should('not.exist')
      cy.get('#editor a').should('not.exist')
    })
  })

  describe('submit + validation', () => {
    it('creates a link on submit with a valid URL', () => {
      cy.pressModK()
      cy.get(INPUT).type('https://example.com{enter}')
      cy.get(POPOVER).should('not.exist')
      cy.editorFirstLinkHref().should('eq', 'https://example.com')
    })

    it('prepends https:// when the user types a bare domain', () => {
      // Users who type `google.com` expect a link to google, not a
      // relative reference that the browser resolves against the host
      // page's origin (`http://<origin>/google.com`). The create popover
      // normalizes on the way in. See `src/utils/normalizeHref.ts`.
      cy.pressModK()
      cy.get(INPUT).type('example.com{enter}')
      cy.editorFirstLinkHref().should('eq', 'https://example.com')
    })

    it('preserves the scheme the user typed (mailto)', () => {
      cy.pressModK()
      cy.get(INPUT).type('mailto:hi@example.com{enter}')
      cy.editorFirstLinkHref().should('eq', 'mailto:hi@example.com')
    })

    it('does not double-prefix when the user already typed http:// or https://', () => {
      cy.pressModK()
      cy.get(INPUT).type('http://example.com{enter}')
      cy.editorFirstLinkHref().should('eq', 'http://example.com')
    })

    it('rejects obviously invalid URLs with a visible error', () => {
      cy.pressModK()
      cy.get(INPUT).type('not a url{enter}')
      cy.get(POPOVER).should('be.visible')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get(ERROR).should('have.class', 'show').and('be.visible')
      cy.get('#editor a').should('not.exist')
    })

    it('rejects scheme-prefixed typos with no TLD (https://googlecom)', () => {
      // linkifyjs's own validator accepts any `scheme://host` shape, so
      // `https://googlecom` (missing dot) slips through unless we gate on
      // a plausible host. See `hasPlausibleHost` in validateURL.ts.
      cy.pressModK()
      cy.get(INPUT).type('https://googlecom{enter}')
      cy.get(POPOVER).should('be.visible')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get('#editor a').should('not.exist')
    })

    it('accepts localhost with a port (dev host)', () => {
      cy.pressModK()
      cy.get(INPUT).type('http://localhost:3000{enter}')
      cy.editorFirstLinkHref().should('eq', 'http://localhost:3000')
    })

    it('upgrades bare localhost:port to https:// (regression: not stored as localhost: scheme)', () => {
      // Regression: `localhost:3000` matched normalizeHref's old
      // `^[a-z][...]+:` regex and was returned unchanged — the
      // browser then resolved `localhost:` as a scheme name and the
      // link broke. The fix detects host:port shape and re-prefixes.
      cy.pressModK()
      cy.get(INPUT).type('localhost:3000{enter}')
      cy.editorFirstLinkHref().should('eq', 'https://localhost:3000')
    })

    it('upgrades bare host:port to https:// for any host (mydomain.com:8080)', () => {
      cy.pressModK()
      cy.get(INPUT).type('mydomain.com:8080{enter}')
      cy.editorFirstLinkHref().should('eq', 'https://mydomain.com:8080')
    })

    it('accepts IPv4 literals', () => {
      cy.pressModK()
      cy.get(INPUT).type('http://127.0.0.1{enter}')
      cy.editorFirstLinkHref().should('contain', '127.0.0.1')
    })

    it('emits tel:+E.164 when the user types a bare phone number', () => {
      cy.pressModK()
      cy.get(INPUT).type('+4733378901{enter}')
      cy.editorFirstLinkHref().should('eq', 'tel:+4733378901')
    })

    it('strips formatting from formatted phones (+1 (555) 123-4567 → tel:+15551234567)', () => {
      cy.pressModK()
      cy.get(INPUT).type('+1 (555) 123-4567{enter}')
      cy.editorFirstLinkHref().should('eq', 'tel:+15551234567')
    })

    it('rejects bare numerics that lack the leading + (no false positive on 5551234567)', () => {
      cy.pressModK()
      cy.get(INPUT).type('5551234567{enter}')
      cy.get(POPOVER).should('be.visible')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get('#editor a').should('not.exist')
    })

    it('emits mailto: when the user types a bare email (regression: matches autolink path)', () => {
      // Regression: bare emails took the URL-prepend branch and came out as
      // `https://user@example.com`, where `user@` is HTTP basic-auth
      // credentials, not the address. Now matches the autolink path.
      cy.pressModK()
      cy.get(INPUT).type('hi@example.com{enter}')
      cy.editorFirstLinkHref().should('eq', 'mailto:hi@example.com')
    })

    it('clears the error state once the user types again', () => {
      cy.pressModK()
      cy.get(INPUT).type('not a url{enter}')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get(INPUT).clear().type('h')
      cy.get(WRAPPER).should('not.have.class', 'error')
      cy.get(ERROR).should('not.have.class', 'show')
    })
  })

  describe('DOM contract', () => {
    it('renders the documented class names', () => {
      cy.pressModK()
      cy.get(POPOVER).within(() => {
        cy.get('.inputs-wrapper').should('exist')
        cy.get('.inputs-wrapper .search-icon').should('exist')
        cy.get('.inputs-wrapper input').should('exist')
        cy.get('.inputs-wrapper .error-message').should('exist')
        cy.get('button[type="submit"]').should('exist')
      })
    })

    it('is hosted inside the floating toolbar shell', () => {
      cy.pressModK()
      cy.get('.floating-popover').should('have.class', 'visible')
      cy.get(`.floating-popover .floating-popover-content ${POPOVER}`).should('exist')
    })
  })
})

// Own describe: the suite above selects `target` in its beforeEach, so an
// `it()` added there would take the non-empty path and prove nothing.
describe('createHyperlinkPopover — collapsed caret', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p>Nothing is selected here.</p>')
    cy.getEditor().then((editor) => {
      editor.commands.focus('end')
    })
  })

  it('inserts the typed URL as the link text when nothing is selected', () => {
    cy.pressModK()
    cy.get(INPUT).type('https://example.com{enter}')
    cy.get(POPOVER).should('not.exist')
    cy.editorFirstLinkHref().should('eq', 'https://example.com')
    cy.get('#editor a').should('contain.text', 'https://example.com')
  })

  it('inserts nothing when the URL is rejected', () => {
    cy.pressModK()
    cy.get(INPUT).type('not a url{enter}')
    cy.get(POPOVER).should('be.visible')
    cy.get('#editor a').should('not.exist')
    cy.get('#editor').should('contain.text', 'Nothing is selected here.')
    cy.get('#editor').should('not.contain.text', 'not a url')
  })
})

// Module scope: keeps top-level selector consts (POPOVER/INPUT/…) from
// colliding with special-schemes.cy.ts under Cypress's shared TS project.
export {}
