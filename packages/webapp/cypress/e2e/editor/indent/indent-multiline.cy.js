/* eslint-disable no-undef */
/**
 * E2E: multiline indent/outdent via commands and keyboard.
 * @see indent-shared.js
 */
import {
  MS,
  PM,
  TAB,
  getEditor,
  getText,
  heading1,
  paragraphNode,
  paragraphSelectionBounds,
  setupIndentSpec
} from './indent-shared.js'

describe('Indent — multiline selection', { testIsolation: false }, () => {
  setupIndentSpec('indent-multiline-e2e')

  describe('Multi-line selection — commands', () => {
    it('prefixes each selected line with Tab via indent()', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent([heading1('S'), paragraphNode('AA'), paragraphNode('BB')])
          .run()
        const { from, to } = paragraphSelectionBounds(ed, 'AA', 'BB')
        ed.chain().setTextSelection({ from, to }).indent().run()
      })
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        const t = getText(win)
        expect(t).to.contain(`${TAB}AA`)
        expect(t).to.contain(`${TAB}BB`)
      })
    })

    it('strips leading tabs from lines that have them via outdent()', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent([heading1('S'), paragraphNode(`${TAB}X`), paragraphNode(`${TAB}Y`)])
          .run()
        const { from, to } = paragraphSelectionBounds(ed, `${TAB}X`, `${TAB}Y`)
        ed.chain().setTextSelection({ from, to }).outdent().run()
      })
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        const t = getText(win)
        expect(t).to.contain('X')
        expect(t).to.contain('Y')
        expect(t).not.to.match(/\tX/)
        expect(t).not.to.match(/\tY/)
      })
    })

    it('outdent() returns false when no line starts with Tab', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent([heading1('S'), paragraphNode('no'), paragraphNode('tabs')])
          .run()
        const { from, to } = paragraphSelectionBounds(ed, 'no', 'tabs')
        const ok = ed.chain().setTextSelection({ from, to }).outdent().run()
        expect(ok).to.eq(false)
      })
    })
  })

  describe('Multi-line — keyboard Tab / Shift-Tab', () => {
    it('adds a leading tab to each selected paragraph with Tab', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent([heading1('S'), paragraphNode('L1'), paragraphNode('L2')])
          .run()
        const { from, to } = paragraphSelectionBounds(ed, 'L1', 'L2')
        ed.chain().setTextSelection({ from, to }).run()
      })
      cy.get(PM).focus()
      cy.wait(MS.ui)
      cy.get(PM).realPress('Tab')
      cy.wait(MS.key)
      cy.window().then((win) => {
        const t = getText(win)
        expect(t).to.contain(`${TAB}L1`)
        expect(t).to.contain(`${TAB}L2`)
      })
    })

    it('strips leading tab from each line in selection with Shift+Tab when present', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent([heading1('S'), paragraphNode(`${TAB}a`), paragraphNode(`${TAB}b`)])
          .run()
        const { from, to } = paragraphSelectionBounds(ed, `${TAB}a`, `${TAB}b`)
        ed.chain().setTextSelection({ from, to }).run()
      })
      cy.get(PM).focus()
      cy.wait(MS.ui)
      cy.get(PM).realPress(['Shift', 'Tab'])
      cy.wait(MS.key)
      cy.window().then((win) => {
        const t = getText(win)
        expect(t).to.contain('a')
        expect(t).to.contain('b')
      })
    })
  })
})
