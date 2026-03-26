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

    cy.get(':is(h2, h3)[data-toc-id]').then(($els) => {
      const texts = [...$els].map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      expect(texts[0]).to.contain('Second Heading')
      expect(texts[1]).to.contain('First Heading')
    })
  })

  it('updates TOC when heading text changes', () => {
    cy.waitForToc()

    cy.get('h2[data-toc-id]').contains('First Heading').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
    cy.wait(100)
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress('End')
    cy.get('.docy_editor > .tiptap.ProseMirror').type(' Modified')
    cy.wait(500)

    cy.get('.toc__list').should('contain', 'First Heading Modified')
  })
})
