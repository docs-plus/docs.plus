/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const SimpleDocument = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const ComplexHierarchyDocument = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Section 1', [heading(2, 'S1-H2', [heading(4, 'S1-H4', [paragraph('leaf 1')])])]),
    section('Section 2', [heading(3, 'S2-H3', [paragraph('leaf 2')])]),
    section('Section 3', [heading(2, 'S3-H2', [heading(5, 'S3-H5', [paragraph('leaf 3')])])]),
    section('Section 4', [heading(2, 'S4-H2', [heading(3, 'S4-H3', [heading(7, 'S4-H7', [])])])]),
    section('Section 5', [heading(4, 'S5-H4', [paragraph('leaf 5')])]),
    section('Section 6', [heading(2, 'S6-H2', [heading(8, 'S6-H8', [paragraph('leaf 6')])])]),
    section('Section 7', [heading(9, 'S7-H9', [paragraph('leaf 7')])])
  ]
}

const getParagraph = () =>
  cy.get('.docy_editor .heading[level="1"] .contentWrapper > .contents > p').first().as('paragraph')

const selectTarget = (text, start, end) =>
  cy.createSelection({
    startSection: 1,
    startParagraph: { text },
    startPosition: start,
    endSection: 1,
    endParagraph: { text },
    endPosition: end
  })

describe('Combined Formatting', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'combined-formatting' })
    cy.wait(150)
  })

  it('applies all primary marks to selected text', () => {
    const text = 'alpha combo omega'

    cy.createDocument(SimpleDocument)
    cy.wait(200)
    getParagraph().click()
    cy.get('@paragraph').realType(text)

    selectTarget(text, 6, 11)
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('.docy_editor').realPress(['Meta', 'u'])
    cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])

    cy.get('@paragraph').find('strong').should('contain', 'combo')
    cy.get('@paragraph').find('em').should('contain', 'combo')
    cy.get('@paragraph').find('u').should('contain', 'combo')
    cy.get('@paragraph').find('s').should('contain', 'combo')
    cy.get('@paragraph').should('contain', text)
    cy.assertFullSchemaValid()
  })

  it('applies combined marks with toolbar buttons and keeps unformatted suffix clean', () => {
    cy.createDocument(SimpleDocument)
    cy.wait(200)
    getParagraph().click()

    cy.get('@paragraph').realType('Prefix ')
    cy.get('[data-testid="toolbar-bold"]').click()
    cy.get('[data-testid="toolbar-underline"]').click()
    cy.get('@paragraph').realType('toolbar-combo')
    cy.get('[data-testid="toolbar-underline"]').click()
    cy.get('[data-testid="toolbar-bold"]').click()
    cy.get('@paragraph').realType(' suffix')

    cy.get('@paragraph').find('strong').should('contain', 'toolbar-combo')
    cy.get('@paragraph').find('u').should('contain', 'toolbar-combo')
    cy.get('@paragraph').should('contain', 'Prefix toolbar-combo suffix')
    cy.assertFullSchemaValid()
  })

  it('clears all marks for selected text via command path while preserving content', () => {
    const text = 'prefix formatted-part suffix'

    cy.createDocument(SimpleDocument)
    cy.wait(200)
    getParagraph().click()
    cy.get('@paragraph').realType(text)

    cy.window().then((win) => {
      const editor = win._editor
      const target = 'formatted-part'

      const findRangeBySubstring = () => {
        let from = null
        let to = null

        editor.state.doc.descendants((node, pos) => {
          if (from !== null) return false
          if (!node.isText || !node.text) return true

          const idx = node.text.indexOf(target)
          if (idx === -1) return true

          from = pos + idx
          to = from + target.length
          return false
        })

        if (from === null || to === null) {
          throw new Error(`Could not locate "${target}" in editor document`)
        }
        return { from, to }
      }

      const range = findRangeBySubstring()

      editor.commands.setTextSelection(range)
      editor
        .chain()
        .focus()
        .toggleBold()
        .toggleItalic()
        .toggleUnderline()
        .toggleStrike()
        .toggleHighlight()
        .run()
    })

    cy.get('@paragraph').find('strong').should('contain', 'formatted-part')
    cy.get('@paragraph').find('em').should('contain', 'formatted-part')
    cy.get('@paragraph').find('u').should('contain', 'formatted-part')
    cy.get('@paragraph').find('s').should('contain', 'formatted-part')
    cy.get('@paragraph').find('mark').should('contain', 'formatted-part')

    cy.window().then((win) => {
      const editor = win._editor
      const target = 'formatted-part'

      let from = null
      let to = null
      editor.state.doc.descendants((node, pos) => {
        if (from !== null) return false
        if (!node.isText || !node.text) return true
        const idx = node.text.indexOf(target)
        if (idx === -1) return true
        from = pos + idx
        to = from + target.length
        return false
      })

      if (from === null || to === null) {
        throw new Error(`Could not locate "${target}" in editor document`)
      }

      editor.commands.setTextSelection({ from, to })
      editor
        .chain()
        .focus()
        .unsetBold()
        .unsetItalic()
        .unsetUnderline()
        .unsetStrike()
        .toggleHighlight()
        .run()
    })

    cy.get('@paragraph').find('strong').should('not.exist')
    cy.get('@paragraph').find('em').should('not.exist')
    cy.get('@paragraph').find('u').should('not.exist')
    cy.get('@paragraph').find('s').should('not.exist')
    cy.get('@paragraph').find('mark').should('not.exist')
    cy.get('@paragraph').should('contain', text)
    cy.assertFullSchemaValid()
  })

  it('keeps schema valid when clear formatting toolbar action is clicked on selection', () => {
    const text = 'prefix toolbar-clear suffix'

    cy.createDocument(SimpleDocument)
    cy.wait(200)
    getParagraph().click()
    cy.get('@paragraph').realType(text)

    selectTarget(text, 7, 20)
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('@paragraph').find('strong').should('contain', 'toolbar-clear')

    selectTarget(text, 7, 20)
    cy.get('[data-testid="toolbar-clear-formatting"]').click()

    cy.get('@paragraph').should('contain', text)
    cy.assertFullSchemaValid()
  })

  it('supports combined formatting in deep headings across a 7-section forest', () => {
    cy.createDocument(ComplexHierarchyDocument)
    cy.wait(350)

    cy.get('.docy_editor > .tiptap > .heading[level="1"]').should('have.length', 7)

    cy.putPosCaretInHeading(7, 'S4-H7', 'end')
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('[data-testid="toolbar-highlight"]').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realType(' formatted')
    cy.get('[data-testid="toolbar-highlight"]').click()
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('.docy_editor').realPress(['Meta', 'b'])

    cy.get('.heading[level="7"] .title').within(() => {
      cy.get('strong').should('exist')
      cy.get('em').should('exist')
      cy.get('mark').should('exist')
      cy.contains('formatted')
    })

    cy.assertFullSchemaValid()
  })
})
