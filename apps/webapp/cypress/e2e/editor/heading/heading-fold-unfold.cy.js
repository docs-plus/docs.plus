/* eslint-disable no-undef */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Heading Fold/Unfold (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'heading-fold-test', persist: true })

    const doc = {
      sections: [
        section('Fold Test Document', [
          heading(2, 'Section A', [
            paragraph('Content under section A'),
            heading(3, 'Nested Under A', [paragraph('Nested body')])
          ]),
          heading(2, 'Section B', [paragraph('Content under section B')])
        ])
      ]
    }

    cy.createDocument(doc)
    cy.wait(500)
  })

  // `contain` passes on hidden text, so these read the crinkle phase and visibility.
  const foldSectionA = () => {
    cy.getTocItem('Section A').find('button.toc__fold-btn').click({ force: true })
    cy.get('.heading-fold-crinkle').should('have.attr', 'data-fold-phase', 'folded')
    cy.contains('.docy_editor p', 'Content under section A').should('not.be.visible')
  }
  const expectSectionAOpen = () => {
    cy.get('.heading-fold-crinkle').should('not.exist')
    cy.get('.heading-fold-hidden').should('not.exist')
    cy.contains('.docy_editor p', 'Content under section A').should('be.visible')
  }

  it('folds and unfolds section content via TOC toggle', () => {
    cy.waitForToc()
    foldSectionA()
    cy.getTocItem('Section A').find('button.toc__fold-btn').click({ force: true })
    expectSectionAOpen()
  })

  it('unfolds a section from a click on its crinkle', () => {
    cy.waitForToc()
    foldSectionA()
    cy.get('.heading-fold-crinkle').click()
    expectSectionAOpen()
  })

  it('includes print media rules so folded content can print expanded (BC-7)', () => {
    // The rules live in the app iframe, so instanceof needs that window's CSSMediaRule.
    cy.window().then((win) => {
      const sheets = Array.from(win.document.styleSheets)
      const hasPrintRule = sheets.some((sheet) => {
        try {
          return Array.from(sheet.cssRules).some(
            (rule) => rule instanceof win.CSSMediaRule && rule.conditionText === 'print'
          )
        } catch {
          return false
        }
      })
      expect(hasPrintRule).to.be.true
    })
  })
})
