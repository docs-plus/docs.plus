/* eslint-disable no-undef */

import { paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const LINK_TEXT = 'example link'
const LINK_HREF = 'https://example.com/page'
const PARAGRAPH_TEXT = 'Click the example link to test preview.'

const PREVIEW_POPOVER = '.hyperlink-preview-popover'
const EDIT_POPOVER = '[data-testid="hyperlink-edit-popover"]'
const EDIT_TEXT_INPUT = `${EDIT_POPOVER} [data-testid="hyperlink-editor-text"]`
const EDIT_URL_INPUT = `${EDIT_POPOVER} [data-testid="hyperlink-editor-url"]`
const EDIT_SUBMIT = `${EDIT_POPOVER} [data-testid="hyperlink-editor-submit"]`
const EDIT_BACK = `${EDIT_POPOVER} [data-testid="hyperlink-editor-back"]`
const EDIT_ERROR = `${EDIT_POPOVER} [data-testid="hyperlink-editor-error"]`
const EDITOR_LINK = '.docy_editor a'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Preview Section', [paragraph(PARAGRAPH_TEXT)])]
}

const insertHyperlink = (href = LINK_HREF) => {
  cy.window().then((win) => {
    const editor = win._editor
    let from, to
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text.includes(LINK_TEXT)) {
        const offset = node.text.indexOf(LINK_TEXT)
        from = pos + offset
        to = from + LINK_TEXT.length
      }
    })
    if (from !== undefined && to !== undefined) {
      editor.chain().focus().setTextSelection({ from, to }).setMark('hyperlink', { href }).run()
    }
  })
}

const clickLink = () => {
  cy.get(EDITOR_LINK)
    .contains(LINK_TEXT)
    .should('be.visible')
    .then(($el) => {
      const el = $el[0]
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
  cy.wait(500)
}

describe('Hyperlink Preview and Edit Popovers', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('mismatched transaction')) return false
    })
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-preview' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
    insertHyperlink()
    cy.get(EDITOR_LINK).should('exist')
  })

  describe('preview popover', () => {
    it('clicking a link shows preview popover', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')
    })

    it('preview displays the link URL', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')
      cy.get(`${PREVIEW_POPOVER} a`).should('exist')
    })

    it('remove button unsets the hyperlink', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')

      cy.get(`${PREVIEW_POPOVER} button.remove`).click()

      cy.get(PREVIEW_POPOVER).should('not.exist')
      cy.get(EDITOR_LINK).should('not.exist')
      cy.get('.docy_editor').should('contain.text', LINK_TEXT)
    })

    it('copy button copies href to clipboard', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')

      cy.get(`${PREVIEW_POPOVER} button.copy`).click()

      cy.window().then((win) => {
        win.navigator.clipboard.readText().then((text) => {
          expect(text).to.include('example.com')
        })
      })
    })
  })

  describe('edit popover', () => {
    it('edit button opens edit popover', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')

      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')
    })

    it('edit popover pre-fills text and URL', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()

      cy.get(EDIT_POPOVER).should('be.visible')
      cy.get(EDIT_TEXT_INPUT).should('have.value', LINK_TEXT)
      cy.get(EDIT_URL_INPUT).invoke('val').should('include', 'example.com')
    })

    it('editing text updates the link text in the editor', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_TEXT_INPUT).clear().type('updated text')
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDITOR_LINK).should('contain.text', 'updated text')
    })

    it('editing URL updates the href', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_URL_INPUT).clear().type('https://updated.com/new')
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('include', 'https://updated.com/new')
    })

    it('edit with invalid URL shows error', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_URL_INPUT).clear().type('not valid')
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDIT_ERROR).should('be.visible')
    })

    // Note: the picker editor treats empty Text as "URL-only edit" — the
    // anchor's existing text is preserved (no error shown). The previous
    // "empty text shows error" test asserted behaviour from the old
    // edit popover and is intentionally retired with the migration.
    it('clearing text leaves the existing link text intact', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_TEXT_INPUT).clear()
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDITOR_LINK).should('contain.text', LINK_TEXT)
    })

    it('Back button returns to preview popover', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_BACK).click()

      cy.get(PREVIEW_POPOVER).should('be.visible')
    })
  })
})

// Same-pad filter links on the `/editor` route: the pad slug is `editor`.
const FILTER_CHIP = `${PREVIEW_POPOVER} .internal-link-chip`
const FILTER_PILLS = `${FILTER_CHIP} .chip-terms > span`
const TWELVE_TERMS = [
  'design',
  'launch',
  'mobile',
  'q3',
  'api',
  'docs',
  'onboarding',
  'pricing',
  'ux',
  'research',
  'beta',
  'customer-research'
]
// One word with no hyphen, so only `overflow-wrap` can break it.
const LONG_TERM = 'supercalifragilisticexpialidociousantidisestablishmentarians'

const filterHref = (terms, mode) =>
  `/editor/${terms.map(encodeURIComponent).join('/')}${mode ? `?mode=${mode}` : ''}`

const openFilterPreview = (terms, mode) => {
  cy.get(EDITOR_LINK).should('exist')
  insertHyperlink(filterHref(terms, mode))
  cy.get(EDITOR_LINK).should('have.attr', 'href', filterHref(terms, mode))
  clickLink()
  cy.get(FILTER_CHIP).should('be.visible')
}

describe('Hyperlink preview: filter link chip', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('mismatched transaction')) return false
    })
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-preview' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
    insertHyperlink()
  })

  it('shows all 12 terms as pills, in order, with no "+N" overflow', () => {
    openFilterPreview(TWELVE_TERMS, 'and')
    cy.get(FILTER_PILLS).should('have.length', 12)
    cy.get(FILTER_PILLS).then(($pills) => {
      expect([...$pills].map((el) => el.textContent)).to.deep.equal(TWELVE_TERMS)
    })
    cy.get(FILTER_CHIP).invoke('text').should('not.match', /\+\d/)
  })

  it('wraps a 60-character term inside its pill', () => {
    expect(LONG_TERM).to.have.length(60)
    openFilterPreview(['design', LONG_TERM], 'and')
    cy.get(FILTER_PILLS)
      .last()
      .should(($pill) => {
        const pill = $pill[0]
        expect(pill.scrollWidth).to.be.at.most(pill.clientWidth)
        const pillRect = pill.getBoundingClientRect()
        const popoverRect = pill.closest(PREVIEW_POPOVER).getBoundingClientRect()
        expect(pillRect.right).to.be.at.most(popoverRect.right)
        // Two or more 16px lines means the term wrapped.
        expect(pillRect.height).to.be.greaterThan(24)
      })
  })

  it('keeps Copy, Edit and Remove in the viewport with 30 terms', () => {
    const terms = Array.from({ length: 30 }, (_, i) => `term-${i + 1}`)
    openFilterPreview(terms, 'or')
    cy.get(FILTER_PILLS).should('have.length', 30)
    cy.window().then((win) => {
      for (const action of ['copy', 'edit', 'remove']) {
        cy.get(`${PREVIEW_POPOVER} .hyperlink-preview-footer button.${action}`).should(($btn) => {
          const rect = $btn[0].getBoundingClientRect()
          expect(rect.top).to.be.at.least(0)
          expect(rect.left).to.be.at.least(0)
          expect(rect.bottom).to.be.at.most(win.innerHeight)
          expect(rect.right).to.be.at.most(win.innerWidth)
        })
      }
    })
  })

  it('renders a markup-like term as plain text', () => {
    openFilterPreview(['<b>x</b>'], 'and')
    cy.get(FILTER_PILLS).should('have.length', 1).and('have.text', '<b>x</b>')
    cy.get(`${FILTER_CHIP} b`).should('not.exist')
  })

  it('names the Go button with every term and the mode, and shows the footer', () => {
    openFilterPreview(['design', 'launch', 'mobile'], 'and')
    cy.get(FILTER_CHIP)
      .should('have.attr', 'aria-label', 'Go to filtered view: design, launch, mobile. Match all.')
      .and('not.have.attr', 'title')
    cy.get(`${FILTER_CHIP} .chip-sub`).should('not.exist')
    cy.get(PREVIEW_POPOVER).should('have.class', 'hyperlink-preview-popover--column')
    cy.get(`${PREVIEW_POPOVER} .hyperlink-preview-footer`).should(
      'contain.text',
      'In this document'
    )
  })
})
