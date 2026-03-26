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

  it('folds and unfolds section content via TOC toggle', () => {
    cy.waitForToc()

    cy.get('.docy_editor .tiptap.ProseMirror').should('contain', 'Content under section A')

    cy.getTocItem('Section A').find('button.toc__fold-btn').click({ force: true })
    cy.wait(500)

    cy.get('.heading-fold-hidden').should('exist')

    cy.getTocItem('Section A').find('button.toc__fold-btn').click({ force: true })
    cy.wait(500)

    cy.get('.docy_editor .tiptap.ProseMirror').should('contain', 'Content under section A')
  })

  it('includes print media rules so folded content can print expanded (BC-7)', () => {
    cy.document().then((doc) => {
      const sheets = Array.from(doc.styleSheets)
      const hasPrintRule = sheets.some((sheet) => {
        try {
          return Array.from(sheet.cssRules).some(
            (rule) => rule instanceof CSSMediaRule && rule.conditionText === 'print'
          )
        } catch {
          return false
        }
      })
      expect(hasPrintRule).to.be.true
    })
  })
})
