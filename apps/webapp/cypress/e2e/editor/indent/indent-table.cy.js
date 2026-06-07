/* eslint-disable no-undef */
/**
 * E2E: Tab / Shift+Tab in tables delegates to goToNextCell / goToPreviousCell.
 * @see indent-shared.js
 */
import {
  EDITOR,
  MS,
  PM,
  TAB,
  getEditor,
  getText,
  insertTable2x2,
  setupIndentSpec
} from './indent-shared.js'

describe('Indent — table cell navigation', { testIsolation: false }, () => {
  setupIndentSpec('indent-table-e2e')

  describe('Table — cell navigation (delegates to extension-table)', () => {
    it('Tab moves selection to the next cell (no literal tab in document)', () => {
      insertTable2x2()
      cy.get(`${PM} table td p`).first().click()
      cy.wait(MS.ui)
      cy.window().then((win) => {
        const before = getEditor(win).state.selection.from
        cy.wrap(before).as('cellBefore')
      })
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.key)
      cy.window().then((win) => {
        const after = getEditor(win).state.selection.from
        cy.get('@cellBefore').then((before) => {
          expect(after).not.to.eq(before)
        })
        expect(getText(win)).not.to.contain(TAB)
      })
    })

    it('Shift+Tab from the second cell returns toward the previous cell (round-trip selection)', () => {
      insertTable2x2()
      cy.get(`${PM} table td p`).first().click()
      cy.wait(MS.ui)
      cy.window().then((win) => {
        cy.wrap(getEditor(win).state.selection.from).as('posFirst')
      })
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.key)
      cy.window().then((win) => {
        cy.wrap(getEditor(win).state.selection.from).as('posSecond')
      })
      cy.get(EDITOR).realPress(['Shift', 'Tab'])
      cy.wait(MS.key)
      cy.window().then((win) => {
        const back = getEditor(win).state.selection.from
        cy.get('@posSecond').then((second) => {
          expect(back).not.to.eq(second)
        })
        cy.get('@posFirst').then((first) => {
          expect(back).to.eq(first)
        })
      })
    })

    it('typing after Tab lands in the next cell (spreadsheet-style flow)', () => {
      insertTable2x2()
      cy.get(`${PM} table td p`).first().click()
      cy.wait(MS.ui)
      cy.get(PM).realType('A')
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.key)
      cy.get(PM).realType('B')
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        const t = getText(win)
        expect(t).to.contain('A')
        expect(t).to.contain('B')
        expect(t).not.to.match(/\tA|\tB/)
      })
    })
  })
})
