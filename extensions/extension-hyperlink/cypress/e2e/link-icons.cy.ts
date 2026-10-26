/// <reference types="cypress" />

// Type-only: pulls StarterKit's undo command augmentation into this
// isolated Cypress TS project (erased at runtime).
import type {} from '@tiptap/starter-kit'
import type { Editor } from '@tiptap/core'

const ICON = '#editor a > .hyperlink-icon'
const PREVIEW = '.hyperlink-preview-popover'
const EDIT = '.hyperlink-edit-popover'
const TEXT_INPUT = `${EDIT} .text-wrapper input`

const MID = '<p>pre <a href="https://a.example">mid</a> post</p>'
const BLOCK_START = '<p><a href="https://a.example">mid</a> post</p>'
const HREFS = ['https://one.example', 'https://two.example', 'https://three.example']
const TEXTS = ['one', 'two', 'three']
const THREE = `<p>a <a href="${HREFS[0]}">one</a> b <a href="${HREFS[1]}">two</a> c <a href="${HREFS[2]}">three</a> d</p>`

// First hyperlink text run in the doc, as model positions.
const linkRange = (editor: Editor): { from: number; to: number } => {
  let range: { from: number; to: number } | undefined
  editor.state.doc.descendants((node, pos) => {
    if (range) return false
    if (node.isText && node.marks.some((mark) => mark.type.name === 'hyperlink')) {
      range = { from: pos, to: pos + node.nodeSize }
    }
  })
  if (!range) throw new Error('linkRange: no hyperlink text node')
  return range
}

const docText = (): Cypress.Chainable<string> =>
  cy.getEditor().then((editor) => editor.state.doc.textContent)

const caret = (): Cypress.Chainable<number> => cy.getEditor().its('state.selection.from')

// Press a key from a known caret, with real focus first (support/e2e.ts focusEditor).
const pressAt = (pos: number, key: 'ArrowLeft' | 'ArrowRight' | 'Delete' | 'Backspace'): void => {
  cy.focusEditor(pos)
  cy.realPress(key)
}

describe('link icons — linkIcon option (icons=element)', () => {
  beforeEach(() => {
    cy.visitPlayground({ query: 'icons=element' })
  })

  it('adds no icon and calls linkIcon no more when typing in and around a link', () => {
    cy.setEditorContent(MID)
    cy.get(ICON).should('have.length', 1)
    cy.window()
      .its('_iconCalls')
      .then((calls) => {
        cy.getEditor().then((editor) => {
          const { from, to } = linkRange(editor)
          cy.focusEditor(from + 1)
          cy.realType('xy')
          // The link grew by two, so to + 2 is its new end.
          cy.focusEditor(to + 2)
          cy.realType('z')
          cy.focusEditor(1)
          cy.realType('w')
        })
        docText().should('eq', 'wpre mxyidz post')
        cy.get(ICON).should('have.length', 1)
        cy.window().its('_iconCalls').should('eq', calls)
      })
  })

  it('keeps icons out of getHTML and getMarkdown, and an HTML round trip keeps the doc', () => {
    cy.setEditorContent(THREE)
    cy.get(ICON).should('have.length', 3)
    cy.window()
      .its('_getMarkdown')
      .then((getMarkdown) => {
        expect(getMarkdown?.()).not.to.contain('hyperlink-icon')
      })
    cy.getEditor().then((editor) => {
      const html = editor.getHTML()
      expect(html).not.to.contain('hyperlink-icon')
      const json = editor.getJSON()
      editor.commands.setContent(html)
      expect(editor.getJSON()).to.deep.equal(json)
    })
    cy.get(ICON).should('have.length', 3)
  })

  it('keeps every text and href through select-all, copy and paste', () => {
    cy.setEditorContent(THREE)
    cy.getEditor().then((editor) => {
      editor.chain().focus().selectAll().run()
    })
    cy.window().then((win) => {
      const clipboardData = new win.DataTransfer()
      cy.get('#editor [contenteditable="true"]')
        .trigger('copy', { clipboardData, bubbles: true, cancelable: true })
        .then(() => {
          expect(clipboardData.getData('text/html')).not.to.contain('hyperlink-icon')
        })
      cy.get('#editor [contenteditable="true"]').trigger('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
    })
    cy.get('#editor a').should('have.length', 3)
    cy.get('#editor a').each(($a, i) => {
      expect($a.text()).to.equal(TEXTS[i])
      expect($a.attr('href')).to.equal(HREFS[i])
    })
    cy.get(ICON).should('have.length', 3)
  })

  it('fills the Edit form Text with the link text only', () => {
    cy.setEditorContent('<p>Visit <a href="https://example.com">Example</a> now.</p>')
    cy.get('#editor a').click()
    cy.get(`${PREVIEW} .edit`).click()
    cy.get(TEXT_INPUT).should('have.value', 'Example')
  })

  it('brings the icon back when undo restores a deleted link', () => {
    // Out of history: within 500 ms one undo would also revert the fixture.
    cy.getEditor().then((editor) => {
      editor.chain().setMeta('addToHistory', false).setContent(MID).run()
    })
    cy.get(ICON).should('have.length', 1)
    cy.getEditor().then((editor) => {
      editor.chain().deleteRange(linkRange(editor)).run()
    })
    cy.get(ICON).should('have.length', 0)
    cy.getEditor().then((editor) => {
      editor.commands.undo()
    })
    cy.get(ICON).should('have.length', 1)
    cy.get('#editor a').should('have.text', 'mid')
  })

  it('moves the caret one position per arrow press beside the icon', () => {
    cy.setEditorContent(MID)
    cy.getEditor().then((editor) => {
      const { from } = linkRange(editor)
      pressAt(from, 'ArrowRight')
      caret().should('eq', from + 1)
      pressAt(from, 'ArrowLeft')
      caret().should('eq', from - 1)
      pressAt(from - 1, 'ArrowRight')
      caret().should('eq', from)
      pressAt(from + 1, 'ArrowLeft')
      caret().should('eq', from)
    })
  })

  it('removes one character per Delete or Backspace beside the icon', () => {
    cy.setEditorContent(MID)
    cy.getEditor().then((editor) => {
      const { from } = linkRange(editor)
      pressAt(from, 'Delete')
      docText().should('eq', 'pre id post')
      pressAt(from, 'Backspace')
      docText().should('eq', 'preid post')
    })
    cy.get(ICON).should('have.length', 1)
    cy.get('#editor a').should('have.text', 'id')
  })

  const orderFixtures = [
    { name: 'a block-start link', html: BLOCK_START, text: 'xyzmid post' },
    { name: 'a mid-paragraph link', html: MID, text: 'pre xyzmid post' }
  ]
  orderFixtures.forEach(({ name, html, text }) => {
    it(`keeps three characters typed at the start of ${name} in order`, () => {
      cy.setEditorContent(html)
      cy.getEditor().then((editor) => {
        cy.focusEditor(linkRange(editor).from)
      })
      cy.realType('xyz')
      docText().should('eq', text)
      cy.get(ICON).should('have.length', 1)
    })
  })

  it('puts the caret at the link start on an icon click', () => {
    cy.setEditorContent(MID)
    cy.focusEditor('end')
    cy.get(ICON).then(($icon) => {
      const icon = $icon[0]
      const r = icon.getBoundingClientRect()
      // The icon has pointer-events: none, so a real click lands on the <a>.
      icon.parentElement!.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2
        })
      )
    })
    cy.getEditor().then((editor) => {
      caret().should('eq', linkRange(editor).from)
    })
  })
})

describe('link icons — a throwing linkIcon (icons=throw)', () => {
  it('logs once and leaves the failed links plain', () => {
    cy.visitPlayground({
      query: 'icons=throw',
      onBeforeLoad: (win) => {
        cy.spy(win.console, 'error').as('err')
      }
    })
    cy.setEditorContent(
      '<p><a href="https://throw.example/1">a</a> <a href="https://throw.example/2">b</a> <a href="https://ok.example">c</a></p>'
    )
    cy.get('#editor a').should('have.length', 3)
    cy.get('#editor a[href^="https://throw.example"] > .hyperlink-icon').should('have.length', 0)
    cy.get('#editor a[href="https://ok.example"] > .hyperlink-icon').should('have.length', 1)
    cy.get('@err')
      .should('have.been.calledOnce')
      .and('have.been.calledWith', '[extension-hyperlink]')
  })
})

export {}
