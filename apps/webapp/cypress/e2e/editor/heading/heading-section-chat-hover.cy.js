/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../fixtures/docMaker'

const H2_CHAT = 'h2[data-toc-id] .ha-single'
const H3_CHAT = 'h3[data-toc-id] .ha-single'

describe('Heading chat button on section hover', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'heading-section-hover', persist: false })

    cy.createDocument({
      sections: [
        section('Doc', [
          heading(2, 'Parent', [
            paragraph('Parent body'),
            heading(3, 'Child', [paragraph('Child body one'), paragraph('Child body two')])
          ])
        ])
      ]
    })

    // The /editor shell renders as history_editor, which hides every .ha-wrap.
    cy.get('.pad.history_editor').invoke('removeClass', 'history_editor')
    cy.get('h3[data-toc-id] .ha-wrap').should('have.css', 'display', 'flex')

    // On a coarse pointer the button is always shown, so the spec would prove nothing.
    cy.window().then((win) => {
      expect(win.matchMedia('(hover: hover) and (pointer: fine)').matches).to.be.true
    })
  })

  for (const theme of ['docsplus', 'docsplus-dark']) {
    it(`shows only the innermost section button while a body block is hovered (${theme})`, () => {
      cy.document().then((doc) => doc.documentElement.setAttribute('data-theme', theme))
      cy.get(H3_CHAT).should('have.css', 'visibility', 'hidden')

      cy.contains('.docy_editor .ProseMirror > p', 'Child body two').realHover()

      cy.get(H3_CHAT).should('have.css', 'visibility', 'visible')
      cy.get(H3_CHAT).should('have.css', 'opacity', '1')
      cy.get(H2_CHAT).should('have.css', 'visibility', 'hidden')

      cy.contains('.docy_editor .ProseMirror > p', 'Parent body').realHover()
      cy.get(H2_CHAT).should('have.css', 'visibility', 'visible')
      cy.get(H3_CHAT).should('have.css', 'visibility', 'hidden')

      cy.get('.toolbars').realHover()
      cy.get(H2_CHAT).should('have.css', 'visibility', 'hidden')
    })
  }
})
