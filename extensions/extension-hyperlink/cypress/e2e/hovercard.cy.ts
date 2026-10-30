/// <reference types="cypress" />

// The playground stub (`?hovercard=…`) counts calls and answers after `delayMs` on the page
// clock. The clock starts after the visit, so `cy.tick` drives the dwell, the stub and the open.
// Pictures load over the real network, so each one is served by an intercept below.

// Cypress 16 fakes rAF and `performance` by default. The engine shows a popover in a rAF.
const TIMERS: Cypress.ClockFunction[] = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'Date'
]

type HovercardWindow = Cypress.AUTWindow & { _hovercard: { calls: string[]; delayMs: number } }

const CARD = '.floating-popover .hyperlink-hovercard'
const SHOWN_CARD = '.floating-popover.visible .hyperlink-hovercard'
const PREVIEW = '.hyperlink-preview-popover'

const svg = (width: number, height: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
  `<rect width="100%" height="100%" fill="#2563eb"/></svg>`
const SVG_HEADERS = { 'content-type': 'image/svg+xml' }

const pictureRoute = (name: string) => ({ pathname: `/readme-media/hovercard/${name}.svg` })

// Plain text comes first, so the card under the links never covers it.
const DOC =
  '<p>Plain text with no link at all.</p>' +
  '<p><a href="https://a.example/">Alpha</a> <a href="https://b.example/">Beta</a> ' +
  '<a href="https://c.example/">Gamma</a></p>' +
  '<p><a href="https://wide.example/">Wide</a> and <a href="https://square.example/">Square</a> ' +
  'and <a href="https://thumb.example/">Thumb</a> and <a href="https://slow.example/">Slow</a></p>' +
  '<p><a href="https://xss.example/">Xss</a> and <a href="https://noshow.example/">Hidden</a> ' +
  'and <a href="https://blocked.example/">Blocked</a></p>'

const stub = (): Cypress.Chainable<HovercardWindow['_hovercard']> =>
  cy.window().then((win) => (win as HovercardWindow)._hovercard)

const hoverLink = (text: string): void => {
  cy.contains('#editor a', text).realHover()
}

const hoverPlain = (): void => {
  cy.contains('#editor p', 'Plain text').realHover({ position: 'left' })
}

// A page promise settled inside `cy.tick` runs its callbacks only at the next real task.
// One real task here lets the stub's answer land at the tick's end time.
const flush = (): void => {
  cy.wrap(null).then(() => new Cypress.Promise<void>((done) => setTimeout(done, 0)))
}

// The picture loads on real time while the clock is fake. A page-side decode of the same
// cached URL settles after the card's own copy, so the next tick sees a settled picture.
const waitForPicture = (alias: `@${string}`): void => {
  cy.wait(alias).then(({ request }) => {
    cy.window().then((win) => {
      const img = new win.Image()
      img.src = request.url
      return img.decode()
    })
  })
  flush()
}

const visitHovercard = (layout: 'cover' | 'adaptive' = 'cover', extra = ''): void => {
  cy.visitPlayground({ query: `hovercard=${layout}${extra}` })
  cy.setEditorContent(DOC)
  // Real key presses reach the page only while it has focus.
  cy.focusEditor()
  // Start every test off the links. A pointer that already rests on a link gets no pointerover.
  hoverPlain()
  // On a coarse pointer the card never opens, so the spec would prove nothing.
  cy.window().then((win) => {
    expect(win.matchMedia('(hover: hover) and (pointer: fine)').matches).to.be.true
  })
  cy.clock(Date.now(), TIMERS)
}

// Data at 250 ms; the card is open by 550 ms whether or not the picture has settled.
const openWideCard = (): void => {
  hoverLink('Wide')
  cy.tick(250)
  flush()
  cy.tick(300)
  cy.get(SHOWN_CARD).should('exist')
}

describe('hovercard — timing', () => {
  beforeEach(() => {
    cy.intercept(pictureRoute('wide'), { body: svg(1200, 630), headers: SVG_HEADERS }).as('wide')
    visitHovercard()
  })

  it('sends no request and shows no card when the pointer passes three links in 100 ms', () => {
    hoverLink('Alpha')
    cy.tick(30)
    hoverLink('Beta')
    cy.tick(30)
    hoverLink('Gamma')
    cy.tick(30)
    hoverPlain()
    cy.tick(1000)
    flush()
    stub().its('calls').should('have.length', 0)
    cy.get(CARD).should('not.exist')
  })

  it('asks once at 150 ms and opens at 500 ms when data and picture come early', () => {
    hoverLink('Wide')
    cy.tick(149)
    stub().its('calls').should('have.length', 0)
    cy.tick(1)
    stub().its('calls').should('deep.equal', ['https://wide.example/'])
    // The stub answers 100 ms after the request.
    cy.tick(100)
    flush()
    waitForPicture('@wide')
    cy.tick(150)
    cy.get(CARD).should('not.exist')
    cy.tick(100)
    cy.get(SHOWN_CARD).should('exist')
    cy.get(`${CARD} .hyperlink-hovercard__image`).should('have.attr', 'data-state', 'ready')
    cy.get(`${CARD} .hyperlink-hovercard__title`).should('have.text', 'Wide page')
    cy.get(`${CARD} .hyperlink-hovercard__site`).should('contain.text', 'wide.example')
    cy.get(`${CARD} .hyperlink-hovercard__description`).should(
      'have.text',
      'A page with a wide share picture.'
    )
    stub().its('calls').should('have.length', 1)
    // Hosts read the kind, so it is public API.
    cy.window()
      .its('_hyperlink')
      .then((hyperlink) => {
        const state = hyperlink.getDefaultController().getState()
        expect(state.kind === 'mounted' && state.popoverKind).to.equal('hovercard')
      })
  })

  it('opens at 1000 ms with a loading well when data comes at 700 ms and the picture never', () => {
    cy.intercept(pictureRoute('slow'), {
      body: svg(1200, 630),
      headers: SVG_HEADERS,
      delay: 30000
    })
    stub().then((s) => {
      s.delayMs = 550
    })
    hoverLink('Slow')
    cy.tick(700)
    flush()
    stub().its('calls').should('have.length', 1)
    cy.tick(299)
    cy.get(CARD).should('not.exist')
    cy.tick(1)
    cy.get(SHOWN_CARD).should('exist')
    cy.get(`${CARD} .hyperlink-hovercard__image`).should('have.attr', 'data-state', 'loading')
  })

  it('drops the pending open when the pointer leaves the link', () => {
    hoverLink('Wide')
    cy.tick(250)
    flush()
    hoverPlain()
    cy.tick(1000)
    cy.get(CARD).should('not.exist')
  })

  it('stays open across a trip to the card inside 300 ms, and closes 300 ms after leaving it', () => {
    openWideCard()
    // Off the link, then onto the card before the close delay ends.
    hoverPlain()
    cy.tick(200)
    cy.get(`${CARD} .hyperlink-hovercard__body`).realHover()
    cy.tick(1000)
    cy.get(SHOWN_CARD).should('exist')
    hoverPlain()
    cy.tick(299)
    cy.get(SHOWN_CARD).should('exist')
    cy.tick(1)
    cy.get(SHOWN_CARD).should('not.exist')
  })
})

describe('hovercard — host read gate', () => {
  beforeEach(() => {
    cy.intercept(pictureRoute('wide'), { body: svg(1200, 630), headers: SVG_HEADERS })
    visitHovercard('cover', '&gate=strict')
  })

  it('sends no request and shows no card for an href the host gate refuses', () => {
    hoverLink('Blocked')
    cy.tick(2000)
    flush()
    stub().its('calls').should('have.length', 0)
    cy.get(CARD).should('not.exist')
    // An allowed link on the same page still works, so the hover itself was live.
    hoverPlain()
    openWideCard()
    stub().its('calls').should('deep.equal', ['https://wide.example/'])
  })
})

describe('hovercard — keys and other popovers', () => {
  const mod = Cypress.platform === 'darwin' ? 'Meta' : 'Control'

  beforeEach(() => {
    cy.intercept(pictureRoute('wide'), { body: svg(1200, 630), headers: SVG_HEADERS }).as('wide')
    visitHovercard()
  })

  it('stays open on bare Meta, Shift and AltGr, and closes on Mod+B and Escape', () => {
    openWideCard()
    cy.realPress('Meta')
    cy.realPress('Shift')
    cy.realPress('AltGraph')
    cy.get(SHOWN_CARD).should('exist')
    cy.realPress([mod, 'b'])
    cy.get(SHOWN_CARD).should('not.exist')

    hoverPlain()
    openWideCard()
    cy.realPress('Escape')
    cy.get(SHOWN_CARD).should('not.exist')
  })

  it('builds no card while the click preview is mounted, and the preview stays', () => {
    // The preview opens under the last line, so it never covers the link hovered above it.
    cy.contains('#editor a', 'Xss').click()
    cy.get(PREVIEW).should('be.visible')
    hoverLink('Wide')
    cy.tick(2000)
    stub().its('calls').should('have.length', 0)
    cy.get(CARD).should('not.exist')
    cy.get(PREVIEW).should('be.visible')
  })

  it('never asks for data when shouldShow says no', () => {
    hoverLink('Hidden')
    cy.tick(2000)
    stub().its('calls').should('have.length', 0)
    cy.get(CARD).should('not.exist')
  })

  it('renders a hostile title as text', () => {
    const alert = cy.stub().as('alert')
    cy.on('window:alert', alert)
    hoverLink('Xss')
    cy.tick(250)
    flush()
    cy.tick(250)
    cy.get(SHOWN_CARD).should('exist')
    cy.get(`${CARD} .hyperlink-hovercard__title`)
      .should('have.text', '<img src=x onerror=alert(1)>')
      .children()
      .should('have.length', 0)
    cy.get(`${CARD} img[src="x"]`).should('not.exist')
    cy.get('@alert').should('not.have.been.called')
  })
})

describe('hovercard — the title opens through navigate (?navigate=spy)', () => {
  const IS_MAC = Cypress.platform === 'darwin'
  const TITLE = `${CARD} .hyperlink-hovercard__title`

  // A dispatched event, so no pointerdown runs first. The card's own capture listeners stay out.
  const fire = (type: 'click' | 'auxclick', init: MouseEventInit): void => {
    cy.get(TITLE).then(($a) => {
      $a[0].dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }))
    })
  }

  const calls = (): Cypress.Chainable<Array<{ href: string; newTab: boolean }>> =>
    cy.window().its('_navigateCalls') as Cypress.Chainable<Array<{ href: string; newTab: boolean }>>

  beforeEach(() => {
    cy.intercept(pictureRoute('wide'), { body: svg(1200, 630), headers: SVG_HEADERS })
    visitHovercard('cover', '&navigate=spy')
    openWideCard()
  })

  it('passes newTab: false for a plain click', () => {
    fire('click', { button: 0 })
    calls().should('deep.equal', [{ href: 'https://wide.example/', newTab: false }])
  })

  it('passes newTab: true for a Mod-click', () => {
    fire('click', { button: 0, metaKey: IS_MAC, ctrlKey: !IS_MAC })
    calls().should('deep.equal', [{ href: 'https://wide.example/', newTab: true }])
  })

  it('passes newTab: true for a middle click', () => {
    fire('auxclick', { button: 1 })
    calls().should('deep.equal', [{ href: 'https://wide.example/', newTab: true }])
  })
})

describe('hovercard — adaptive layout', () => {
  beforeEach(() => {
    visitHovercard('adaptive')
  })

  it('shows a near-square picture as a thumb', () => {
    cy.intercept(pictureRoute('square'), { body: svg(460, 460), headers: SVG_HEADERS }).as('square')
    hoverLink('Square')
    cy.tick(250)
    flush()
    waitForPicture('@square')
    cy.tick(250)
    cy.get(SHOWN_CARD).should('have.class', 'hyperlink-hovercard--thumb')
    cy.get(`${CARD} .hyperlink-hovercard__image`).should('have.attr', 'data-state', 'ready')
  })

  it('keeps the text in place when a thumb fails after open', () => {
    cy.intercept(pictureRoute('thumb'), { statusCode: 404, delay: 900 }).as('thumb')
    hoverLink('Thumb')
    // Data at 250 ms; the picture is still pending, so the card opens at 550 ms.
    cy.tick(250)
    flush()
    cy.tick(300)
    cy.get(SHOWN_CARD).should('have.class', 'hyperlink-hovercard--thumb')
    cy.get(`${CARD} .hyperlink-hovercard__image`).should('have.attr', 'data-state', 'loading')
    // The shell scales in, and a rect includes that transform. Measure once it ends.
    cy.get('.floating-popover.visible').should(($shell) => {
      expect(getComputedStyle($shell[0]).transform).to.be.oneOf([
        'none',
        'matrix(1, 0, 0, 1, 0, 0)'
      ])
    })
    // The thumb holds column 2, so a removed thumb would widen the text column.
    const box = (el: HTMLElement) => {
      const { left, width } = el.getBoundingClientRect()
      return { left, width }
    }
    cy.get(`${CARD} .hyperlink-hovercard__title`).then(($title) => {
      const before = box($title[0])
      cy.wait('@thumb')
      cy.get(`${CARD} .hyperlink-hovercard__image`).should('have.attr', 'data-state', 'failed')
      // Past the 200 ms fade, so a fold or a removal would have finished.
      cy.wait(300)
      cy.get(`${CARD} .hyperlink-hovercard__title`).should(($after) => {
        expect(box($after[0])).to.deep.equal(before)
      })
    })
  })
})

export {}
