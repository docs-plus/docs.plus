/* eslint-disable no-undef */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

const rowLink = ($list, text) => {
  const link = [...$list.find('.toc__link')].find((el) => el.textContent.trim() === text)
  expect(link, text).to.exist
  return link.closest('.toc__row-link')
}

// Retries until the row in `state` has its class and both titles start at one x.
const shouldAlign = (state) =>
  cy.get('.toc__list').should(($list) => {
    if (state) {
      expect(rowLink($list, state.text).closest('.toc__row'), state.text).to.have.class(state.cls)
    }
    const parentX = rowLink($list, 'Parent Row').getBoundingClientRect().left
    const leafX = rowLink($list, 'Leaf Row').getBoundingClientRect().left
    expect(Math.abs(parentX - leafX)).to.be.below(0.5)
  })

describe('TOC row alignment', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'toc-row-alignment-test', persist: true })
    cy.createDocument({
      sections: [
        section('Alignment Title', [
          heading(2, 'Parent Row', [
            paragraph('Parent body'),
            heading(3, 'Child Row', [paragraph('Child body')])
          ]),
          heading(2, 'Leaf Row', [paragraph('Leaf body')])
        ])
      ]
    })
    cy.waitForToc()
  })

  it('starts a leaf title where a parent title of the same level starts, in every row state', () => {
    shouldAlign()
    cy.getTocItem('Parent Row')
      .find('> .toc__row button.toc__fold-btn')
      .should('have.attr', 'aria-expanded', 'true')
    cy.getTocItem('Leaf Row').find('button.toc__fold-btn').should('not.exist')

    cy.getTocItem('Parent Row').find('> .toc__row button.toc__fold-btn').click({ force: true })
    cy.getTocItem('Parent Row')
      .find('> .toc__row button.toc__fold-btn')
      .should('have.attr', 'aria-expanded', 'false')
    shouldAlign()

    cy.getTocItem('Leaf Row').find('> .toc__row .toc__row-link').click()
    shouldAlign({ text: 'Leaf Row', cls: 'menu-active' })

    // /editor mounts no scroll spy, so the spy class is set by hand.
    cy.getTocItem('Parent Row').find('> .toc__row').invoke('addClass', 'menu-focus')
    shouldAlign({ text: 'Parent Row', cls: 'menu-focus' })

    cy.getTocItem('Leaf Row').find('> .toc__row').realHover()
    shouldAlign()
  })
})
