/* eslint-disable no-undef */
/**
 * E2E: literal Tab / Shift+Tab in paragraphs; heading vs paragraph vs blockquote gates.
 * @see indent-shared.js
 */
import {
  EDITOR,
  MS,
  PM,
  TAB,
  TEST_TITLE,
  getEditor,
  getText,
  heading,
  heading1,
  paragraph,
  paragraphNode,
  paragraphTextCaretPos,
  section,
  setupIndentSpec
} from './indent-shared.js'

describe('Indent — paragraph literal tab & gates', { testIsolation: false }, () => {
  setupIndentSpec('indent-paragraph-e2e')

  describe('Paragraph — literal tab', () => {
    it('inserts a tab at the caret with Tab', () => {
      cy.createDocument({
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Indent section', [paragraph('Hello')])]
      })
      cy.get(`${PM} p`).first().click()
      cy.get(PM).realPress('Home')
      cy.get(PM).realPress('Tab')
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        expect(getText(win)).to.contain(`${TAB}Hello`)
      })
    })

    it('inserts a tab before typed text when Tab is pressed then typing continues', () => {
      cy.createDocument({
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('S', [paragraph('')])]
      })
      cy.get(`${PM} p`).first().click()
      cy.get(PM).realPress('Tab')
      cy.wait(MS.cmd)
      cy.get(PM).realType('x')
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        expect(getText(win)).to.contain(`${TAB}x`)
      })
    })

    it('removes one leading tab with Shift+Tab when the caret is after the tab', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent([heading1('S'), paragraphNode(`${TAB}${TAB}Outdent me`)])
          .run()
        let afterTwoTabs = null
        ed.state.doc.descendants((node, pos) => {
          if (node.type.name === 'paragraph' && node.textContent?.includes('Outdent me')) {
            afterTwoTabs = pos + 1 + 2
          }
        })
        if (afterTwoTabs == null) throw new Error('paragraph with Outdent me not found')
        ed.chain().setTextSelection(afterTwoTabs).run()
      })
      cy.get(PM).focus()
      cy.wait(MS.cmd)
      cy.get(PM).realPress(['Shift', 'Tab'])
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        const t = getText(win)
        expect(t).to.contain(`${TAB}Outdent me`)
        expect(t).not.to.contain(`${TAB}${TAB}${TAB}Outdent`)
      })
    })

    it('does not change plain text when Shift+Tab has nothing to strip', () => {
      cy.createDocument({
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('S', [paragraph('NoTabHere')])]
      })
      cy.get(`${PM} p`).first().click()
      cy.get(PM).realPress('Home')
      cy.wait(MS.ui)
      cy.get(PM).realPress(['Shift', 'Tab'])
      cy.wait(MS.cmd)
      cy.window().then((win) => {
        expect(getText(win)).to.contain('NoTabHere')
        expect(getText(win)).not.to.contain(`${TAB}NoTabHere`)
      })
    })
  })

  describe('Gates — paragraph vs heading', () => {
    it('does not allow literal indent in a heading (default allowlist is paragraph in doc/blockquote)', () => {
      cy.createDocument({
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Sec', [heading(2, 'H2Title', [paragraph('body')])])]
      })
      cy.putPosCaretInHeading(2, 'H2Title', 'start')
      cy.window().then((win) => {
        const ed = getEditor(win)
        expect(ed.can().indent()).to.eq(false)
        expect(ed.commands.indent()).to.eq(false)
      })
    })

    it('allows literal indent in a normal paragraph', () => {
      cy.createDocument({
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Sec', [paragraph('Para')])]
      })
      cy.get(`${PM} p`).first().click()
      cy.window().then((win) => {
        expect(getEditor(win).can().indent()).to.eq(true)
      })
    })

    it('allows literal Tab in blockquote paragraph (default contexts include blockquote)', () => {
      cy.window().then((win) => {
        const ed = getEditor(win)
        ed.chain()
          .focus()
          .setContent({
            type: 'doc',
            content: [
              {
                type: 'blockquote',
                content: [paragraphNode('Quoted')]
              }
            ]
          })
          .run()
        const p = paragraphTextCaretPos(ed, 'Quoted')
        expect(p).not.to.equal(null)
        ed.chain().focus().setTextSelection(p).run()
      })
      cy.get(EDITOR).realPress('Tab')
      cy.wait(MS.key)
      cy.window().then((win) => {
        expect(getText(win)).to.match(/\tQuoted/)
      })
    })
  })
})
