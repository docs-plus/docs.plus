/* eslint-disable no-undef */
/**
 * E2E: list Tab delegation (sink/lift) and programmatic nested / mixed documents.
 * @see indent-shared.js
 */
import {
  EDITOR,
  MS,
  PM,
  docH1WithTwoListItems,
  docMixedParagraphAndList,
  docNestedBulletTwoLevels,
  getEditor,
  getText,
  paragraphTextCaretPos,
  seedEmptySection,
  setDoc,
  setupIndentSpec,
  startBulletListFromEmptyParagraph,
  TAB
} from './indent-shared.js'

describe('Indent — lists (delegation & nested)', { testIsolation: false }, () => {
  setupIndentSpec('indent-lists-e2e')

  describe('Bullet list — delegation (sink / lift)', () => {
    it('nests a list item with Tab (sinkListItem before literal indent)', () => {
      seedEmptySection()
      startBulletListFromEmptyParagraph()
      cy.get(`${EDITOR} ul > li`).realType('Root')
      cy.get(`${EDITOR} ul > li`).realPress('Enter')
      cy.wait(MS.cmd)
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.list)
      cy.get(`${PM} ul li ul`).should('exist')
      cy.get(`${PM} ul li ul li`).should('exist')
    })

    it('lifts a nested item with Shift+Tab', () => {
      seedEmptySection()
      startBulletListFromEmptyParagraph()
      cy.get(`${EDITOR} ul > li`).realType('Root')
      cy.get(`${EDITOR} ul > li`).realPress('Enter')
      cy.wait(MS.cmd)
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.list)
      cy.get(`${PM} ul li ul li`).should('exist')
      cy.get(`${PM} ul li ul li`).click()
      cy.wait(MS.ui)
      cy.get(EDITOR).realPress(['Shift', 'Tab'])
      cy.wait(MS.list)
      cy.get(`${PM} ul li ul`).should('not.exist')
    })

    it('nested keyboard flow: two levels deep then Shift+Tab steps up (bullet-list parity)', () => {
      seedEmptySection()
      startBulletListFromEmptyParagraph()
      cy.get(`${EDITOR} ul > li`).realType('A')
      cy.get(`${EDITOR} ul > li`).realPress('Enter')
      cy.get(EDITOR).realPress('Tab')
      cy.get(`${EDITOR} ul li ul li`).realType('B')
      cy.get(`${EDITOR} ul li ul li`).realPress('Enter')
      cy.wait(80)
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.key)
      cy.get(`${EDITOR} ul li ul li ul li`).should('exist')
      cy.get(`${EDITOR} ul li ul li ul li`).click()
      cy.wait(MS.ui)
      cy.get(EDITOR).realPress(['Shift', 'Tab'])
      cy.wait(MS.key)
      cy.get(`${EDITOR} ul li ul li ul`).should('not.exist')
    })
  })

  describe('Complex document — programmatic schema, nested lists, Tab routing', () => {
    it('Shift+Tab lifts programmatic nested bullet (setContent), no nested ul after lift', () => {
      setDoc(docNestedBulletTwoLevels())
      cy.get(`${EDITOR} ul li ul li`).should('contain', 'Nested')
      cy.get(`${EDITOR} ul li ul li`).click()
      cy.wait(MS.ui)
      cy.get(EDITOR).realPress(['Shift', 'Tab'])
      cy.wait(MS.list)
      cy.get(`${PM} ul li ul`).should('not.exist')
      cy.window().then((win) => {
        expect(getText(win)).to.contain('Nested')
        expect(getText(win)).to.contain('Top')
      })
    })

    it('Tab on second top-level bullet line sinks under first (typed), matching multi-item tree', () => {
      setDoc(docH1WithTwoListItems('bulletList', 'L', 'First', 'Second'))
      cy.get(`${EDITOR} ul > li`).eq(1).click()
      cy.wait(MS.ui)
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.list)
      cy.get(`${EDITOR} ul li ul li`).should('contain', 'Second')
    })

    it('ordered list: Tab sinks second item (delegation, not literal tab in list)', () => {
      setDoc(docH1WithTwoListItems('orderedList', 'OL', 'One', 'Two'))
      cy.get(`${EDITOR} ol > li`).eq(1).click()
      cy.wait(MS.ui)
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.list)
      cy.get(`${PM} ol li ol li`).should('contain', 'Two')
    })

    it('mixed blocks: Tab in paragraph adds literal tab; Tab in list still delegates to sink', () => {
      setDoc(docMixedParagraphAndList())
      cy.contains(`${PM} p`, 'Plain body').click()
      cy.wait(MS.ui)
      cy.get(EDITOR).realPress('Home')
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        expect(getText(win)).to.match(/\tPlain body/)
      })

      cy.get(`${EDITOR} ul > li`).contains('OnlyItem').click()
      cy.wait(MS.ui)
      cy.get(`${EDITOR} ul > li`).realPress('Enter')
      cy.wait(80)
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.list)
      cy.get(`${EDITOR} ul li ul li`).should('exist')
    })

    it('deep nest: Tab from level-2 item creates third-level bullet', () => {
      setDoc(docNestedBulletTwoLevels())
      cy.get(`${EDITOR} ul li ul li`).contains('Nested').click()
      cy.wait(MS.ui)
      cy.get(`${EDITOR} ul li ul li`).realPress('Enter')
      cy.wait(80)
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.list)
      cy.get(`${PM} ul li ul li ul`).should('exist')
    })

    it('indent() in nested list item is false (default contexts exclude listItem paragraphs)', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain().focus().setContent(docNestedBulletTwoLevels()).run()
        const p = paragraphTextCaretPos(ed, 'Nested')
        expect(p).not.to.equal(null)
        const ok = ed.chain().focus().setTextSelection(p).indent().run()
        expect(ok).to.eq(false)
      })
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        expect(getText(win)).to.contain('Nested')
        expect(getText(win)).not.to.match(new RegExp(`${TAB}Nested`))
      })
    })
  })
})
