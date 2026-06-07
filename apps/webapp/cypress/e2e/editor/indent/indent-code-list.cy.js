/* eslint-disable no-undef */
/**
 * E2E: code block (no literal paragraph indent); list item indent() API gate.
 * @see indent-shared.js
 */
import {
  MS,
  PM,
  TAB,
  TEST_TITLE,
  bulletList,
  getEditor,
  getText,
  heading1,
  listItem,
  paragraphTextCaretPos,
  section,
  setupIndentSpec
} from './indent-shared.js'

describe('Indent — code block & list item gate', { testIsolation: false }, () => {
  setupIndentSpec('indent-code-list-e2e')

  describe('Code block — literal indent not in default allowlist', () => {
    it('keeps code block active and does not apply literal indent Tab from Indent extension', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent([heading1('S'), { type: 'paragraph', content: [] }])
          .toggleCodeBlock()
          .insertContent('codehere')
          .run()
      })
      cy.get(`${PM} pre`).should('exist')
      cy.get(`${PM} pre`).click()
      cy.wait(MS.cmd)
      cy.get(PM).realPress('Tab')
      cy.wait(MS.key)
      cy.window().then((win) => {
        const ed = getEditor(win)
        expect(ed.isActive('codeBlock')).to.eq(true)
        expect(getText(win)).to.contain('codehere')
      })
    })
  })

  describe('List item — indent() blocked (parent listItem)', () => {
    it('does not insert tab via indent() inside list item paragraph', () => {
      cy.createDocument({
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('L', [bulletList([listItem('Item')])])]
      })
      cy.window().then((win) => {
        const ed = getEditor(win)
        const p = paragraphTextCaretPos(ed, 'Item')
        expect(p).not.to.equal(null)
        const ok = ed.chain().focus().setTextSelection(p).indent().run()
        expect(ok).to.eq(false)
      })
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        expect(getText(win)).to.contain('Item')
        expect(getText(win)).not.to.match(new RegExp(`${TAB}Item`))
      })
    })
  })
})
