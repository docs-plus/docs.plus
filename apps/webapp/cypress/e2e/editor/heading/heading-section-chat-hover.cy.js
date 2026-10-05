/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../fixtures/docMaker'

const H2_CHAT = 'h2[data-toc-id] .ha-single'
const H3_CHAT = 'h3[data-toc-id] .ha-single'
const H3_WRAP = 'h3[data-toc-id] .ha-wrap'
const SHEET = '.docy_editor.tiptap__editor'

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
    cy.get(H3_WRAP).should('have.css', 'display', 'flex')
    // The pad's EditorContent pads the sheet and the playground does not. Match the pad.
    cy.get(SHEET).invoke('addClass', 'px-6 pt-8 sm:p-8')

    // On a coarse pointer the button is always shown, so the spec would prove nothing.
    cy.window().then((win) => {
      expect(win.matchMedia('(hover: hover) and (pointer: fine)').matches).to.be.true
    })
  })

  it('shows only the innermost section button while a body block is hovered', () => {
    cy.get(H3_CHAT).should('have.css', 'visibility', 'hidden')

    cy.contains('.docy_editor .ProseMirror > p', 'Child body two').as('childBody').realHover()

    cy.get(H3_CHAT).should('have.css', 'visibility', 'visible')
    cy.get(H3_CHAT).should('have.css', 'opacity', '1')
    cy.get(H2_CHAT).should('have.css', 'visibility', 'hidden')

    // The pointer crosses the sheet padding on its way to the button. It has left
    // view.dom there but not the sheet, so the class must hold.
    cy.get(SHEET).then(($sheet) => {
      const sheet = $sheet[0]
      const view = sheet.querySelector(':scope > .ProseMirror')
      cy.get('@childBody').then(($p) => {
        const sheetRect = sheet.getBoundingClientRect()
        const x = (view.getBoundingClientRect().right + sheetRect.right) / 2
        const pRect = $p[0].getBoundingClientRect()
        const y = pRect.top + pRect.height / 2
        const hit = sheet.ownerDocument.elementFromPoint(x, y)
        expect(sheet.contains(hit) && !view.contains(hit), 'point is in the sheet padding').to.be
          .true

        cy.get(SHEET).realHover({
          position: { x: x - sheetRect.left, y: y - sheetRect.top },
          scrollBehavior: false
        })
      })
    })
    // The button fades out over 150ms, so visibility alone cannot catch a lost class.
    cy.get(H3_WRAP).should('have.class', 'is-section-hover')
    cy.get(H3_CHAT).should('have.css', 'visibility', 'visible')

    cy.get(H3_CHAT).realHover({ scrollBehavior: false })
    cy.get(H3_CHAT).should('have.css', 'visibility', 'visible')

    cy.contains('.docy_editor .ProseMirror > p', 'Parent body').realHover()
    cy.get(H2_CHAT).should('have.css', 'visibility', 'visible')
    cy.get(H3_CHAT).should('have.css', 'visibility', 'hidden')

    cy.get('.toolbars').realHover()
    cy.get(H2_CHAT).should('have.css', 'visibility', 'hidden')
  })
})
