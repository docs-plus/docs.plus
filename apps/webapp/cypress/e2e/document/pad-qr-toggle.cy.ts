/**
 * Needs the whole local stack up (webapp, WS, REST, Supabase). Local-only: no CI lane
 * runs e2e/document/**. The spec never edits the pad, so no document row is written.
 * Run it with `--config baseUrl=http://localhost:3000` (or wherever the webapp is).
 */

const toggle = () => cy.get('[data-testid="toolbar-qr"]', { timeout: 40000 })
const card = () => cy.get('[data-testid="pad-qr-code"]')
const freshSlug = () => `e2e-qr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const modKey = Cypress.platform === 'darwin' ? 'Meta' : 'Control'
const VIEWPORT = { width: 1680, height: 1050 }

const intersects = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

const rectOf = (selector: string) => cy.get(selector).then(($el) => $el[0].getBoundingClientRect())

describe('pad QR toggle (full stack)', () => {
  let slug: string

  beforeEach(() => {
    slug = freshSlug()
    cy.viewport(VIEWPORT.width, VIEWPORT.height)
  })

  it('is a toggle button with one name in both states', () => {
    cy.visit(`/${slug}/alpha?h=beta`)
    toggle()
      .should('have.attr', 'aria-pressed', 'false')
      .and('have.attr', 'aria-label', 'Document QR code')
      .click()
    toggle()
      .should('have.attr', 'aria-pressed', 'true')
      .and('have.attr', 'aria-label', 'Document QR code')

    toggle().focus()
    toggle().should('have.focus')
    cy.realPress('Space')
    toggle().should('have.attr', 'aria-pressed', 'false')
    card().should('not.exist')

    toggle().should('have.focus')
    cy.realPress('Enter')
    toggle().should('have.attr', 'aria-pressed', 'true')
  })

  it('encodes the clean pad URL and clears the sheet, the TOC and Find', () => {
    const host = new URL(Cypress.config('baseUrl') as string).host
    cy.visit(`/${slug}/alpha?h=beta`)
    toggle().click()

    card().should('be.visible')
    card().find('svg[role="img"]').should('have.attr', 'aria-label', `QR code for ${host}/${slug}`)

    card().then(($card) => {
      const qr = $card[0].getBoundingClientRect()
      // The heading chips straddle the sheet edge; measured 26px outside it.
      rectOf('.tiptap__editor').then((sheet) => {
        const withChips = new DOMRect(sheet.x, sheet.y, sheet.width + 26, sheet.height)
        expect(intersects(qr, withChips), 'card clears the sheet and its chips').to.eq(false)
      })
      rectOf('.tableOfContents').then((toc) => {
        expect(intersects(qr, toc), 'card clears the TOC').to.eq(false)
      })
    })

    cy.get('.ProseMirror').click()
    cy.realPress([modKey, 'f'])
    cy.get('[data-testid="caret-find-bar"]').should('be.visible')
    card().then(($card) => {
      rectOf('[data-testid="caret-find-bar"]').then((find) => {
        const qr = $card[0].getBoundingClientRect()
        expect(intersects(qr, find), 'card clears the Find bar').to.eq(false)
      })
    })
  })

  it('sits 14px under the toolbar and resizes from its corner handle', () => {
    cy.visit(`/${slug}`)
    toggle().click()
    card().should('be.visible')
    rectOf('.toolbars').then((bar) => {
      card().then(($card) => {
        expect($card[0].getBoundingClientRect().top - bar.bottom).to.be.closeTo(14, 1)
      })
    })

    const handle = () => card().find('[data-testid="pad-qr-resize"]')
    // Retrying width check: a click resizes the code over the 200ms panel tween.
    const codeWidthIs = (width: number) =>
      card()
        .find('svg[role="img"]')
        .parent()
        .should(($box) => expect($box[0].getBoundingClientRect().width).to.be.closeTo(width, 2))

    handle()
      .should('have.attr', 'role', 'slider')
      .and('have.attr', 'aria-label', 'Resize QR code')
      .and('have.attr', 'aria-valuenow', '128')
      .and('have.css', 'opacity', '0')
    codeWidthIs(128)
    card().realHover()
    handle().should('have.css', 'opacity', '1')

    // The room cap is the size container's height less 84px (5.25rem), and never above 1024.
    card()
      .parent()
      .then(($room) => {
        const cap = Math.min(1024, $room[0].clientHeight - 84)

        handle().then(($handle) => {
          const box = $handle[0].getBoundingClientRect()
          const x = box.left + box.width / 2
          const y = box.top + box.height / 2
          // Down and left past the cap, with no scroll that would move the handle.
          const to = { x: Math.max(x - 1000, 1), y: Math.min(y + 700, VIEWPORT.height - 1) }
          handle().realMouseDown({ position: 'center', scrollBehavior: false })
          cy.get('body').realMouseMove(to.x, to.y, {
            keepMouseDownButton: 'left',
            scrollBehavior: false
          })
          cy.get('body').realMouseUp({ ...to, scrollBehavior: false })
        })
        codeWidthIs(cap)

        card().realHover()
        handle().realClick({ scrollBehavior: false })
        codeWidthIs(128)
      })
  })

  it('shows the card on a narrow window too, and hides it with the toggle', () => {
    cy.viewport(1280, 800)
    cy.visit(`/${slug}`)
    toggle().click()
    toggle().should('have.attr', 'aria-pressed', 'true')
    card().should('be.visible')

    toggle().click()
    card().should('not.exist')
  })
})
