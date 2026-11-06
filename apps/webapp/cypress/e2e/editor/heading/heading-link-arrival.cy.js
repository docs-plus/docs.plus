/* eslint-disable no-undef */
import { describeOnPad, freshSlug, IPHONE_UA } from '../filter/filter-shared'

// #338. A heading link lands on its heading when a fold or a Filter hides it, and a cold
// `?id=` lands after sync. The target is an H3, because a fold hides only a section's body.
const SECTIONS = 30
const HOST = 'Section 24'
const TARGET = 'Deep Target'
const LINK_TEXT = 'jump to the target'
const LAND_TOLERANCE_PX = 16
const PAD = '.docy_editor .ProseMirror'

const text = (value) => ({ type: 'text', text: value })
const heading = (level, value) => ({ type: 'heading', attrs: { level }, content: [text(value)] })
const paragraph = (value) => ({ type: 'paragraph', content: [text(value)] })

// "Intro" is the only Filter match, and it holds the link; HOST holds TARGET.
const arrivalDoc = () => ({
  type: 'doc',
  content: [
    heading(1, 'Arrival Doc'),
    heading(2, 'Intro'),
    paragraph(`Please ${LINK_TEXT} now.`),
    ...Array.from({ length: SECTIONS }, (_, i) => {
      const name = `Section ${i + 1}`
      const body = paragraph(`Body of ${name.toLowerCase()}. `.repeat(40))
      return name === HOST
        ? [heading(2, name), body, heading(3, TARGET), paragraph('Target body.')]
        : [heading(2, name), body]
    }).flat()
  ]
})

const editorOf = () => cy.get(PAD).then(($pm) => $pm[0].editor)
const headingId = (name) =>
  cy.get(PAD).contains('h2, h3', name).invoke('attr', 'data-toc-id').should('be.a', 'string')

const visitPad = (path, userAgent) => {
  cy.visit(path, userAgent ? { headers: { 'user-agent': userAgent } } : undefined)
  cy.get(PAD, { timeout: 40000 }).should(($pm) => {
    expect($pm[0].editor, 'TipTap editor on the pad').to.exist
  })
  // The pad shows only after the first sync. A seed written before it can be lost.
  cy.get(PAD).should('be.visible')
}

/** Seeds the pad, then links LINK_TEXT to TARGET. Yields TARGET's toc-id. */
const seedPad = (slug) => {
  visitPad(`/${slug}`)
  editorOf().then((editor) => editor.commands.setContent(arrivalDoc()))
  cy.get(`${PAD} h2[data-toc-id]`, { timeout: 10000 }).should('have.length', SECTIONS + 1)
  return headingId(TARGET).then((id) => {
    cy.location('origin').then((origin) => {
      editorOf().then((editor) => {
        let from = -1
        editor.state.doc.descendants((node, pos) => {
          if (from < 0 && node.isText && node.text.includes(LINK_TEXT)) {
            from = pos + node.text.indexOf(LINK_TEXT)
          }
        })
        editor
          .chain()
          .setTextSelection({ from, to: from + LINK_TEXT.length })
          .setMark('hyperlink', { href: `${origin}/${slug}?id=${id}` })
          .run()
      })
    })
    cy.get(`${PAD} a`).contains(LINK_TEXT).should('exist')
    return cy.wrap(id)
  })
}

const targetHeading = () => cy.get(PAD).contains('h3', TARGET)

const expectLanded = () =>
  cy.get('.editorWrapper').should(($wrapper) => {
    const target = [...$wrapper[0].querySelectorAll('h3')].find((h) =>
      h.textContent.includes(TARGET)
    )
    expect(target, 'target heading').to.exist
    expect(target.getClientRects().length, 'target is rendered').to.be.greaterThan(0)
    const offset = target.getBoundingClientRect().top - $wrapper[0].getBoundingClientRect().top
    expect(Math.abs(offset), 'target offset from the scroller top').to.be.at.most(LAND_TOLERANCE_PX)
  })

/** The real click path: the link opens its preview, and the heading chip runs the link. */
const clickHeadingLink = () => {
  cy.get(`${PAD} a`)
    .contains(LINK_TEXT)
    .closest('a')
    .then(($a) => {
      const el = $a[0]
      const rect = el.getBoundingClientRect()
      el.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 0,
          view: el.ownerDocument.defaultView
        })
      )
    })
  cy.get('.hyperlink-preview-popover .internal-link-chip').click()
}

/** The folds saved on this device, across every pad key, must hold `ids`. */
const expectSavedFolds = (ids) =>
  cy.window().should((win) => {
    const saved = Object.keys(win.localStorage)
      .filter((key) => key.startsWith('editor-folds-'))
      .flatMap((key) => JSON.parse(win.localStorage.getItem(key)))
    expect(saved, 'saved folds').to.include.members(ids)
  })

const foldByHand = (name) =>
  headingId(name).then((id) => {
    editorOf().then((editor) => editor.commands.toggleFold(id))
    cy.get(PAD).contains('p', `Body of ${name.toLowerCase()}.`).should('not.be.visible')
  })

describeOnPad('Heading link arrival', () => {
  let slug

  beforeEach(() => {
    cy.viewport(1456, 1000)
    slug = freshSlug('heading-arrival')
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('opens a folded target for the session and keeps the saved folds', () => {
    seedPad(slug)
    foldByHand(HOST)
    targetHeading().should('not.be.visible')
    headingId(HOST).then((hostId) => {
      clickHeadingLink()
      targetHeading().should('be.visible')
      expectLanded()
      expectSavedFolds([hostId])

      // A plain persist:false fold write would stop saving this hand fold.
      foldByHand('Section 3')
      headingId('Section 3').then((manualId) => {
        expectSavedFolds([hostId, manualId])
        cy.reload()
        cy.get(`${PAD} h2[data-toc-id]`, { timeout: 40000 }).should('have.length', SECTIONS + 1)
        targetHeading().should('not.be.visible')
        cy.get(PAD).contains('p', 'Body of section 3.').should('not.be.visible')
      })
    })
  })

  it('opens a target that a Filter hides', () => {
    seedPad(slug)
    cy.get('[aria-label="Filter document"]').first().click({ force: true })
    cy.get('#filterSearchBox').type('intro{enter}')
    cy.location('pathname').should('include', 'intro')
    targetHeading().should('not.be.visible')
    // The desktop panel stays open after Enter; it covers nothing the click needs.
    clickHeadingLink()
    targetHeading().should('be.visible')
    expectLanded()
    // Only the sections that hide the target open.
    cy.get(PAD).contains('p', 'Body of section 3.').should('not.be.visible')
  })

  it('lands a cold ?id= after sync', () => {
    seedPad(slug).then((id) => {
      visitPad(`/${slug}?id=${id}`)
      expectLanded()
    })
  })

  it('lands a cold ?id= under a Filter, and the Filter does not fold it again', () => {
    seedPad(slug).then((id) => {
      visitPad(`/${slug}/intro?id=${id}`)
      cy.get(`${PAD} .heading-fold-hidden`, { timeout: 10000 }).should('exist')
      targetHeading().should('be.visible')
      expectLanded()
      cy.wait(1000)
      targetHeading().should('be.visible')
    })
  })

  it('lands a cold ?id= on the phone pad', () => {
    seedPad(slug).then((id) => {
      visitPad(`/${slug}?id=${id}`, IPHONE_UA)
      cy.get('.mobileLayoutRoot').should('exist')
      expectLanded()
    })
  })

  it('ignores a malformed or deleted id', () => {
    seedPad(slug)
    for (const id of ['a%22b%5C', 'deleted-heading-id']) {
      visitPad(`/${slug}?id=${id}`)
      cy.get(`${PAD} h2[data-toc-id]`).should('have.length', SECTIONS + 1)
      cy.wait(500)
      cy.get('.editorWrapper').its('0.scrollTop').should('eq', 0)
    }
  })
})
