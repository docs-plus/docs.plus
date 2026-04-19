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
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(POPOVER).should('be.visible')
      cy.get(INPUT).should('be.focused')
    })

    it('starts with Apply disabled', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(SUBMIT).should('be.disabled')
    })

    it('enables Apply once the input has a value', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('https://example.com')
      cy.get(SUBMIT).should('not.be.disabled')
    })

    it('dismisses on Escape without creating a link', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('https://example.com').type('{esc}')
      cy.get(POPOVER).should('not.exist')
      cy.get('#editor a').should('not.exist')
    })

    it('dismisses on outside click without creating a link', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('https://example.com')
      cy.get('body').click('topLeft')
      cy.get(POPOVER).should('not.exist')
      cy.get('#editor a').should('not.exist')
    })
  })

  describe('submit + validation', () => {
    it('creates a link on submit with a valid URL', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('https://example.com{enter}')
      cy.get(POPOVER).should('not.exist')
      cy.editorFirstLinkHref().should('eq', 'https://example.com')
    })

    it('prepends https:// when the user types a bare domain', () => {
      // Users who type `google.com` expect a link to google, not a
      // relative reference that the browser resolves against the host
      // page's origin (`http://<origin>/google.com`). The create popover
      // normalizes on the way in. See `src/utils/normalizeHref.ts`.
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('example.com{enter}')
      cy.editorFirstLinkHref().should('eq', 'https://example.com')
    })

    it('preserves the scheme the user typed (mailto)', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('mailto:hi@example.com{enter}')
      cy.editorFirstLinkHref().should('eq', 'mailto:hi@example.com')
    })

    it('does not double-prefix when the user already typed http:// or https://', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('http://example.com{enter}')
      cy.editorFirstLinkHref().should('eq', 'http://example.com')
    })

    it('rejects obviously invalid URLs with a visible error', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('not a url{enter}')
      cy.get(POPOVER).should('be.visible') // stays open
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get(ERROR).should('have.class', 'show').and('be.visible')
      cy.get('#editor a').should('not.exist')
    })

    it('rejects scheme-prefixed typos with no TLD (https://googlecom)', () => {
      // linkifyjs's own validator accepts any `scheme://host` shape, so
      // `https://googlecom` (missing dot) slips through unless we gate on
      // a plausible host. See `hasPlausibleHost` in validateURL.ts.
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('https://googlecom{enter}')
      cy.get(POPOVER).should('be.visible')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get('#editor a').should('not.exist')
    })

    it('accepts localhost with a port (dev host)', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('http://localhost:3000{enter}')
      cy.editorFirstLinkHref().should('eq', 'http://localhost:3000')
    })

    it('accepts IPv4 literals', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('http://127.0.0.1{enter}')
      cy.editorFirstLinkHref().should('contain', '127.0.0.1')
    })

    it('clears the error state once the user types again', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('not a url{enter}')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get(INPUT).clear().type('h')
      cy.get(WRAPPER).should('not.have.class', 'error')
      cy.get(ERROR).should('not.have.class', 'show')
    })
  })

  describe('DOM contract', () => {
    it('renders the documented class names', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(POPOVER).within(() => {
        cy.get('.inputs-wrapper').should('exist')
        cy.get('.inputs-wrapper .search-icon').should('exist')
        cy.get('.inputs-wrapper input').should('exist')
        cy.get('.inputs-wrapper .error-message').should('exist')
        cy.get('button[type="submit"]').should('exist')
      })
    })

    it('is hosted inside the floating toolbar shell', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get('.floating-toolbar').should('have.class', 'visible')
      cy.get(`.floating-toolbar .floating-toolbar-content ${POPOVER}`).should('exist')
    })
  })
})
