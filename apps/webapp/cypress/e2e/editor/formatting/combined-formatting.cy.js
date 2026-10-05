/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE, haveNamedHeadingCount } from '../../../support/commands'

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
    section('Section 4', [heading(2, 'S4-H2', [heading(3, 'S4-H3', [heading(4, 'S4-H4', [])])])]),
    section('Section 5', [heading(4, 'S5-H4', [paragraph('leaf 5')])]),
    section('Section 6', [heading(2, 'S6-H2', [heading(6, 'S6-H6', [paragraph('leaf 6')])])]),
    section('Section 7', [heading(6, 'S7-H6', [paragraph('leaf 7')])])
  ]
}

const EDITOR = '.docy_editor .tiptap.ProseMirror'
const MOD = Cypress.platform === 'darwin' ? 'Meta' : 'Control'

const getParagraph = () => cy.get(`${EDITOR} > p`).first().as('paragraph')

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
  })

  it('keeps a heading and its toc-id when Clear formatting runs with a collapsed caret', () => {
    cy.createDocument(ComplexHierarchyDocument)

    cy.putPosCaretInHeading(2, 'S1-H2', 'end')
    cy.get(EDITOR).should('have.focus')
    cy.contains('h2[data-toc-id]', 'S1-H2')
      .invoke('attr', 'data-toc-id')
      .then((tocId) => {
        cy.realPress([MOD, 'b'])
        cy.realPress([MOD, '\\'])
        cy.realType('x')

        // Editor state, not h2 text: heading widgets add DOM text inside the h2.
        cy.window().should((win) => {
          let heading = null
          win._editor.state.doc.forEach((node) => {
            if (node.attrs['toc-id'] === tocId) heading = node
          })
          expect(heading?.attrs.level).to.eq(2)
          expect(heading?.textContent).to.eq('S1-H2x')
          expect(heading?.lastChild.marks).to.have.length(0)
        })
      })
  })

  it('clears marks across a heading and a link and keeps both', () => {
    const marked = (text, ...marks) => ({ type: 'text', text, marks })

    cy.window().then((win) => {
      win._editor.commands.setContent({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
          {
            type: 'heading',
            attrs: { level: 2, 'toc-id': 'clear-h2' },
            content: [marked('Clear', { type: 'italic' }), { type: 'text', text: ' H2' }]
          },
          {
            type: 'paragraph',
            content: [
              marked('bold', { type: 'bold' }),
              { type: 'text', text: ' and ' },
              marked(
                'link',
                { type: 'bold' },
                { type: 'hyperlink', attrs: { href: 'https://example.com' } }
              )
            ]
          }
        ]
      })
    })
    cy.get(`${EDITOR} a[href="https://example.com"]`).should('exist')

    cy.window().then((win) => {
      const editor = win._editor
      const { doc } = editor.state
      editor.commands.focus()
      editor.commands.setTextSelection({
        from: doc.child(0).nodeSize + 1,
        to: doc.content.size - 1
      })
    })
    cy.get('[data-testid="toolbar-clear-formatting"]').should('not.be.disabled').click()

    cy.get(EDITOR).find('strong, em').should('not.exist')
    cy.get(`${EDITOR} a[href="https://example.com"]`).should('contain', 'link')
    cy.get(`${EDITOR} > h2[data-toc-id="clear-h2"]`).should('contain', 'Clear H2')
    cy.window().its('_editor.state.doc.textContent').should('eq', 'TitleClear H2bold and link')
  })

  it('supports combined formatting in deep headings across a 7-section forest', () => {
    cy.createDocument(ComplexHierarchyDocument)
    cy.wait(350)

    cy.get('.docy_editor > .tiptap > h1[data-toc-id]').should(haveNamedHeadingCount(7))

    cy.putPosCaretInHeading(4, 'S4-H4', 'end')
    cy.get('.docy_editor').realPress(['Meta', 'b'])
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('[data-testid="toolbar-highlight"]').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realType(' formatted')
    cy.get('[data-testid="toolbar-highlight"]').click()
    cy.get('.docy_editor').realPress(['Meta', 'i'])
    cy.get('.docy_editor').realPress(['Meta', 'b'])

    cy.contains('h4[data-toc-id]', 'S4-H4').within(() => {
      cy.get('strong').should('exist')
      cy.get('em').should('exist')
      cy.get('mark').should('exist')
      cy.contains('formatted')
    })
  })
})
