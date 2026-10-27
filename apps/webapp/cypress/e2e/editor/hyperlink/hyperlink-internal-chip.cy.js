/* eslint-disable no-undef */

import { paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const HEADING_TEXT = 'heading chip'
const EXTERNAL_TEXT = 'external link'
const PAD_TEXT = 'other pad link'
// The same words in both paragraphs, so the chip and the plain line wrap alike.
const LONG_TEXT =
  'This long chip runs past the end of the first line so it has to wrap onto a second line and keep the same height as a plain paragraph does'

const EDITOR = '.docy_editor > .tiptap.ProseMirror'
const CHIP = `${EDITOR} a:has(> .hyperlink-icon[data-link-kind])`

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Chip Section', [
      paragraph(`A ${HEADING_TEXT} here.`),
      paragraph(`An ${EXTERNAL_TEXT} here.`),
      paragraph(`An ${PAD_TEXT} here.`),
      paragraph(LONG_TEXT),
      paragraph(LONG_TEXT)
    ])
  ]
}

// Marks the nth match of `text` (0-based), so the two long paragraphs stay apart.
const linkText = (text, href, nth = 0) => {
  cy.window().then((win) => {
    const editor = win._editor
    const ranges = []
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return
      const offset = node.text.indexOf(text)
      if (offset >= 0) ranges.push({ from: pos + offset, to: pos + offset + text.length })
    })
    const range = ranges[nth]
    expect(range, `match ${nth} of "${text}"`).to.exist
    editor.chain().setTextSelection(range).setMark('hyperlink', { href }).run()
  })
}

const linkFor = (text) => cy.get(`${EDITOR} a`).contains(text).closest('a')

describe('Internal link chips', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('mismatched transaction')) return false
    })
    cy.viewport(1280, 900)
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-internal-chip' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('a same-pad heading link shows a spoken kind icon and is a chip', () => {
    cy.location('origin').then((origin) => {
      linkText(HEADING_TEXT, `${origin}/editor?h=intro&id=abc123`)
    })
    cy.get(`${EDITOR} a:has(> .hyperlink-icon[data-link-kind="heading"])`)
      .should('have.length', 1)
      .and('contain.text', HEADING_TEXT)
      .find('> .hyperlink-icon')
      .should('have.attr', 'aria-label', 'Heading')
      .and('have.attr', 'role', 'img')
      .find('svg')
      .should('exist')
  })

  it('an external link gets no kind and no chip', () => {
    linkText(EXTERNAL_TEXT, 'https://example.com/page')
    linkFor(EXTERNAL_TEXT).should('exist')
    cy.get(`${EDITOR} [data-link-kind]`).should('not.exist')
  })

  it('a same-origin link to another pad shows only the docs.plus logo', () => {
    cy.location('origin').then((origin) => {
      linkText(PAD_TEXT, `${origin}/other-pad`)
    })
    linkFor(PAD_TEXT)
      .find('> img.hyperlink-icon')
      .should('have.attr', 'src')
      .and('match', /\/icons\/logo\.svg$/)
    linkFor(PAD_TEXT).find('[data-link-kind]').should('not.exist')
  })

  it('a chip that wraps keeps the height of a plain two-line paragraph', () => {
    cy.location('origin').then((origin) => {
      linkText(LONG_TEXT, `${origin}/editor?id=abc123`, 0)
    })
    cy.get(CHIP).should('have.length', 1)
    cy.get(`${EDITOR} > p`).then(($ps) => {
      const ps = [...$ps].filter((p) => p.textContent.includes(LONG_TEXT))
      expect(ps).to.have.length(2)
      const [chipP, plainP] = ps
      const chip = chipP.querySelector('a')
      expect(chip.getClientRects().length, 'chip line boxes').to.eq(2)
      const lineHeight = parseFloat(getComputedStyle(plainP).lineHeight)
      const plainHeight = plainP.getBoundingClientRect().height
      expect(Math.round(plainHeight / lineHeight), 'plain paragraph lines').to.eq(2)
      expect(chipP.getBoundingClientRect().height).to.be.closeTo(plainHeight, 0.5)
    })
  })
})
