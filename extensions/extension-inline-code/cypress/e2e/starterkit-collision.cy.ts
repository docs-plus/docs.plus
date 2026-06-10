/// <reference types="cypress" />

// With StarterKit's `code` mark left enabled (?starterkitCode=on), InlineCode's
// higher priority must win so backtick input and pasted <code> produce inlineCode
// — not StarterKit's `code`. Both render <code>, so assert on the mark name.

describe('inline code — StarterKit code coexistence', () => {
  beforeEach(() => {
    cy.visitPlayground('?starterkitCode=on')
    cy.setEditorContent('<p></p>')
    cy.getEditor().then((e) => e.chain().focus('end').run())
  })

  it('backtick typing produces inlineCode, not StarterKit code', () => {
    cy.typeInEditor('`x`')
    cy.selectText('x')
    cy.getEditor().should((e) => {
      expect(e.isActive('inlineCode')).to.equal(true)
      expect(e.isActive('code')).to.equal(false)
    })
  })

  it('pasted <code> becomes inlineCode, not StarterKit code', () => {
    cy.pasteData('text/html', '<p><code>y</code></p>')
    cy.selectText('y')
    cy.getEditor().should((e) => {
      expect(e.isActive('inlineCode')).to.equal(true)
      expect(e.isActive('code')).to.equal(false)
    })
  })
})

export {}
