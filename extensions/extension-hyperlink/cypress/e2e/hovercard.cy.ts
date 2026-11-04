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

type HovercardStub = {
  calls: string[]
  delayMs: number
  views: Array<{ href: string; state: string; destroyed: number }>
  attachedAtDestroy: boolean[]
}
type HovercardWindow = Cypress.AUTWindow & { _hovercard: HovercardStub }

const CARD = '.floating-popover .hyperlink-hovercard'
const SHOWN_CARD = '.floating-popover.visible .hyperlink-hovercard'
const PREVIEW = '.hyperlink-preview-popover'
const MAIN = `${CARD} .hyperlink-hovercard__main`
const DEMO = `${CARD} .demo-card`
const BARS = `${CARD} .hyperlink-hovercard__bar`
const NOTE = `${CARD} .hyperlink-hovercard__note`
const COPY = `${CARD} button[aria-label="Copy link"], ${CARD} button[aria-label="Link copied"]`

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
  '<p><a href="https://wide.example/">Wide</a> and <a href="https://slow.example/">Slow</a> ' +
  'and <a href="https://builtin.example/">Builtin</a> and <a href="https://throw.example/">Throw</a></p>' +
  '<p><a href="https://xss.example/">Xss</a> and <a href="https://noshow.example/">Hidden</a> ' +
  'and <a href="https://blocked.example/">Blocked</a></p>' +
  '<p><a href="https://late.example/">Late</a> and <a href="https://notitle.example/">Notitle</a> ' +
  'and <a href="https://deep.example/docs/page?q=1#top">Deep</a></p>'

const stub = (): Cypress.Chainable<HovercardStub> =>
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

const visitHovercard = (mode: 'on' | 'custom' = 'on', extra = ''): void => {
  cy.visitPlayground({ query: `hovercard=${mode}${extra}` })
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
const openCard = (text = 'Wide'): void => {
  hoverLink(text)
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

  it('opens with loading bars at 500 ms, then swaps the data into the same card', () => {
    cy.intercept(pictureRoute('slow'), {
      body: svg(1200, 630),
      headers: SVG_HEADERS,
      delay: 30000
    })
    stub().then((s) => {
      s.delayMs = 550
    })
    hoverLink('Slow')
    cy.tick(499)
    cy.get(CARD).should('not.exist')
    cy.tick(1)
    cy.get(SHOWN_CARD).should('exist')
    cy.get(BARS).should('have.length', 3)
    // The link line is real from the first frame.
    cy.get(`${CARD} .hyperlink-hovercard__host`).should('have.text', 'slow.example')
    cy.get(COPY).should('exist')
    cy.get('.floating-popover').then(($shell) => {
      // The data lands at 700 ms; the picture never loads.
      cy.tick(200)
      flush()
      cy.get(BARS).should('not.exist')
      cy.get(`${CARD} .hyperlink-hovercard__title`).should('have.text', 'Slow page')
      cy.get(`${CARD} .hyperlink-hovercard__image`).should('have.attr', 'data-state', 'loading')
      cy.get('.floating-popover')
        .should('have.length', 1)
        .and(($now) => {
          expect($now[0]).to.equal($shell[0])
        })
    })
  })

  it('gives up at 4 s with the no-preview line, and a late answer leaves the card alone', () => {
    stub().then((s) => {
      s.delayMs = 5000
    })
    hoverLink('Late')
    cy.tick(500)
    cy.get(BARS).should('have.length', 3)
    cy.tick(3499)
    cy.get(BARS).should('have.length', 3)
    cy.tick(1)
    cy.get(BARS).should('not.exist')
    cy.get(NOTE).should('have.text', 'No preview for this page.')
    // The answer comes at 5150 ms.
    cy.tick(2000)
    flush()
    stub().its('calls').should('have.length', 1)
    cy.get(SHOWN_CARD).should('exist')
    cy.get(NOTE).should('have.text', 'No preview for this page.')
    cy.get(`${CARD} .hyperlink-hovercard__title`).should('not.exist')
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
    openCard()
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
    visitHovercard('on', '&gate=strict')
  })

  it('sends no request and shows no card for an href the host gate refuses', () => {
    hoverLink('Blocked')
    cy.tick(2000)
    flush()
    stub().its('calls').should('have.length', 0)
    cy.get(CARD).should('not.exist')
    // An allowed link on the same page still works, so the hover itself was live.
    hoverPlain()
    openCard()
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
    openCard()
    cy.realPress('Meta')
    cy.realPress('Shift')
    cy.realPress('AltGraph')
    cy.get(SHOWN_CARD).should('exist')
    cy.realPress([mod, 'b'])
    cy.get(SHOWN_CARD).should('not.exist')

    hoverPlain()
    openCard()
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
    openCard('Xss')
    cy.get(`${CARD} .hyperlink-hovercard__title`)
      .should('have.text', '<img src=x onerror=alert(1)>')
      .children()
      .should('have.length', 0)
    cy.get(`${CARD} img[src="x"]`).should('not.exist')
    cy.get('@alert').should('not.have.been.called')
  })
})

describe('hovercard — card bodies', () => {
  beforeEach(() => {
    visitHovercard()
  })

  it('shows only the no-preview line for data with no title', () => {
    openCard('Notitle')
    cy.get(NOTE).should('have.text', 'No preview for this page.')
    cy.get(`${CARD} .hyperlink-hovercard__title`).should('not.exist')
    cy.get(`${CARD} .hyperlink-hovercard__description`).should('not.exist')
    cy.get(`${CARD} .hyperlink-hovercard__host`).should('have.text', 'notitle.example')
  })
})

describe('hovercard — the link line', () => {
  beforeEach(() => {
    cy.intercept(pictureRoute('wide'), { body: svg(1200, 630), headers: SVG_HEADERS })
    visitHovercard()
  })

  it('shows the host, then the path and query, and drops the hash', () => {
    openCard('Deep')
    cy.get(`${CARD} .hyperlink-hovercard__host`).should('have.text', 'deep.example')
    cy.get(`${CARD} .hyperlink-hovercard__path`).should('have.text', '/docs/page?q=1')
  })

  it('swaps Copy link to a check for 1500 ms after the write', () => {
    openCard()
    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('write').resolves()
    })
    cy.get(COPY).click()
    cy.get('@write').should('have.been.calledOnceWith', 'https://wide.example/')
    cy.get(COPY).should('have.attr', 'data-copied')
    cy.get(COPY).should('have.attr', 'aria-label', 'Link copied')
    cy.get(SHOWN_CARD).should('exist')
    cy.tick(1499)
    cy.get(COPY).should('have.attr', 'data-copied')
    cy.tick(1)
    cy.get(COPY).should('not.have.attr', 'data-copied')
    cy.get(COPY).should('have.attr', 'aria-label', 'Copy link')
  })

  it('keeps Tab out of the card, and Tab closes it', () => {
    openCard()
    cy.realPress('Tab')
    cy.get(SHOWN_CARD).should('not.exist')
    cy.document().then((doc) => {
      expect(doc.activeElement?.closest('.floating-popover')).to.equal(null)
    })
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
    visitHovercard('on', '&navigate=spy')
    openCard()
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

describe('hovercard — custom render (?hovercard=custom)', () => {
  const views = (): Cypress.Chainable<HovercardStub['views']> => stub().its('views')

  beforeEach(() => {
    cy.intercept(pictureRoute('wide'), { body: svg(1200, 630), headers: SVG_HEADERS })
    visitHovercard('custom')
  })

  it('draws the loading and data states, and destroys the loading view on the swap', () => {
    stub().then((s) => {
      s.delayMs = 550
    })
    hoverLink('Wide')
    cy.tick(500)
    cy.get(SHOWN_CARD).should('exist')
    cy.get(DEMO).should('have.attr', 'data-state', 'loading')
    cy.get(MAIN).should('not.exist')
    // The data lands at 700 ms and replaces the loading view in the same frame.
    cy.tick(200)
    flush()
    cy.get(DEMO).should('have.length', 1).and('have.attr', 'data-state', 'data')
    cy.get(DEMO).should('contain.text', 'Wide page')
    cy.get(CARD).should('have.length', 1)
    views().should('deep.equal', [
      { href: 'https://wide.example/', state: 'loading', destroyed: 1 },
      { href: 'https://wide.example/', state: 'data', destroyed: 0 }
    ])
  })

  it('keeps the built-in card when render returns null', () => {
    openCard('Builtin')
    cy.get(`${CARD} .hyperlink-hovercard__title`).should('have.text', 'https://builtin.example/')
    cy.get(DEMO).should('not.exist')
    views().should('have.length', 0)
  })

  it('destroys the shown view once when the card closes', () => {
    openCard()
    cy.get(DEMO).should('have.attr', 'data-state', 'data')
    views().should('deep.equal', [{ href: 'https://wide.example/', state: 'data', destroyed: 0 }])
    hoverPlain()
    cy.tick(300)
    cy.get(SHOWN_CARD).should('not.exist')
    // The view is destroyed once the exit fade has removed the card.
    cy.tick(150)
    views().should('deep.equal', [{ href: 'https://wide.example/', state: 'data', destroyed: 1 }])
  })

  it('destroys the shown view only after the card has left the DOM', () => {
    openCard()
    hoverPlain()
    cy.tick(300)
    // The exit ends on transitionend, or on the engine's 150 ms fallback timer.
    cy.tick(150)
    cy.get('.floating-popover').should('not.exist')
    stub().its('attachedAtDestroy').should('deep.equal', [false])
  })

  it('destroys a drawn view when the pointer leaves before the open', () => {
    hoverLink('Wide')
    // The data lands at 250 ms and is drawn at once; the card would open at 500 ms.
    cy.tick(250)
    flush()
    views().should('deep.equal', [{ href: 'https://wide.example/', state: 'data', destroyed: 0 }])
    hoverPlain()
    views().should('deep.equal', [{ href: 'https://wide.example/', state: 'data', destroyed: 1 }])
    cy.tick(1000)
    cy.get(CARD).should('not.exist')
  })

  it('falls back to the built-in card when render throws, and logs once per editor', () => {
    cy.window().then((win) => {
      cy.spy(win.console, 'error').as('error')
    })
    openCard('Throw')
    cy.get(`${CARD} .hyperlink-hovercard__title`).should('have.text', 'https://throw.example/')
    hoverPlain()
    cy.tick(300)
    cy.get(SHOWN_CARD).should('not.exist')
    openCard('Throw')
    cy.get(`${CARD} .hyperlink-hovercard__title`).should('have.text', 'https://throw.example/')
    cy.get('@error').should('have.been.calledOnce')
    cy.get('@error').should(
      'have.been.calledWith',
      '[extension-hyperlink]',
      'render threw; the built-in card shows'
    )
  })
})

export {}
