/* eslint-disable no-undef */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('TOC Render and Drag (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'toc-render-drag-test', persist: true })

    const doc = {
      sections: [
        section('TOC Test Document', [
          heading(2, 'First Heading', [paragraph('First content')]),
          heading(2, 'Second Heading', [paragraph('Second content')]),
          heading(3, 'Sub Heading', [paragraph('Sub content')])
        ])
      ]
    }

    cy.createDocument(doc)
    cy.wait(500)
  })

  it('renders TOC with expected headings', () => {
    cy.waitForToc()

    cy.get('.toc__list').should('be.visible')
    cy.get('.toc__list').should('contain', 'TOC Test Document')
    cy.get('.toc__list').should('contain', 'First Heading')
    cy.get('.toc__list').should('contain', 'Second Heading')
    cy.get('.toc__list').should('contain', 'Sub Heading')
  })

  it('moves a heading before another via programmatic TOC drag', () => {
    cy.waitForToc()

    cy.dragTocItem('Second Heading', 'First Heading', { position: 'before' })
    cy.wait(500)

    cy.get('h2[data-toc-id]').then(($els) => {
      const texts = [...$els].map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      expect(texts[0]).to.contain('Second Heading')
      expect(texts[1]).to.contain('First Heading')
    })
  })

  it('updates TOC when heading text changes', () => {
    cy.waitForToc()

    cy.get('h2[data-toc-id]').contains('First Heading').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress('End')
    cy.get('.docy_editor > .tiptap.ProseMirror').type(' Modified')
    cy.wait(500)

    cy.get('.toc__list').should('contain', 'First Heading Modified')
  })
})

describe('TOC drag keeps heading scale sizes', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'toc-drag-heading-scale-test', persist: true })
    cy.createDocument({
      sections: [
        section('Scale Title', [
          heading(2, 'Section A', [
            paragraph('a text'),
            heading(3, 'Detail A', [paragraph('a detail')])
          ]),
          heading(2, 'Section B', [
            paragraph('b text'),
            heading(3, 'Detail B', [paragraph('b detail')])
          ])
        ])
      ]
    })
    cy.waitForToc()
  })

  it('gives every moved heading its rank size', () => {
    cy.dragTocItem('Section B', 'Section A', { position: 'before' })

    cy.get('.docy_editor > .tiptap.ProseMirror > :is(h1, h2, h3, h4, h5, h6)').should(($all) => {
      // TrailingNode appends an empty H1.
      const els = [...$all].filter((el) => el.textContent.trim())
      const texts = els.map((el) => el.textContent.trim())
      expect(texts).to.deep.equal(['Scale Title', 'Section B', 'Detail B', 'Section A', 'Detail A'])
      expect(els[0].getAttribute('style') ?? '').not.to.contain('--hd-size')
      for (const el of els.slice(1)) {
        expect(el.getAttribute('style') ?? '', el.textContent.trim()).to.contain('--hd-size')
      }
      const size = (i) => getComputedStyle(els[i]).fontSize
      expect(size(2)).to.equal(size(4))
    })
  })
})
