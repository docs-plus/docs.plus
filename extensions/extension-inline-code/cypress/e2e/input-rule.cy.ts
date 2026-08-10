/// <reference types="cypress" />

// Backtick input rule — real typing, since programmatic insertContent does not
// fire input rules.

describe('inline code — input rule', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
    cy.getEditor().then((e) => e.chain().focus('end').run())
  })

  it('converts `text` to inline code while typing mid-paragraph', () => {
    cy.typeInEditor('see `code` here')
    cy.get('#editor code').should('have.text', 'code')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('see code here'))
  })

  it('converts `text` typed at the start of a paragraph', () => {
    cy.typeInEditor('`x`')
    cy.get('#editor code').should('have.text', 'x')
  })

  it('does not fire on triple backticks mid-paragraph', () => {
    cy.typeInEditor('a ```x``` b')
    cy.get('#editor code').should('not.exist')
  })

  // `code: true` makes @tiptap/core suppress every extension's input rules
  // next to code-marked text, so bold/typography cannot rewrite code content.
  it('other input rules do not rewrite text typed inside a code span', () => {
    cy.setEditorContent('<p><code>code</code></p>')
    cy.setCaretAfter('co') // caret mid-span
    cy.typeInEditor(' **x**') // leading space would arm StarterKit's bold rule
    cy.get('#editor strong').should('not.exist')
    cy.get('#editor code').should('have.text', 'co **x**de') // literal asterisks kept
  })

  // Regression: the prefix guard must stay a lookbehind. With the old in-match
  // capture, a prefix char equal to the content char made markInputRule find the
  // wrong range. Typing x`x` then collapsed all four chars to one code-marked "x".
  it('keeps a prefix char equal to the code content intact (x`x`)', () => {
    cy.typeInEditor('x`x`')
    cy.get('#editor code').should('have.text', 'x')
    cy.getEditor().should((e) => {
      expect(e.getText()).to.equal('xx')
      expect(e.getHTML()).to.contain('x<code>x</code>')
    })
  })

  // Regression: `HardBreak.renderText()` is a newline, which `[^`]+` matches, so
  // an unclosed backtick before Shift+Enter used to mark one code span across the
  // break. The leading paragraph proves the replacement stayed inside seed's block.
  it('leaves a backtick pair spanning a hard break alone', () => {
    cy.setEditorContent('<p>Hello world</p><p>seed</p>')
    cy.setCaretAfter('seed')
    cy.typeInEditor('`foo ')
    cy.pressKey('Enter', { shiftKey: true })
    cy.typeInEditor('bar`')
    cy.get('#editor code').should('not.exist')
    cy.getEditor().should((e) => {
      expect(e.getText()).to.contain('Hello world')
      expect(e.getText()).to.contain('`foo ')
      expect(e.getText()).to.contain('bar`')
    })
  })

  it('Backspace right after the rule restores the literal backticks', () => {
    cy.typeInEditor('`x`')
    cy.get('#editor code').should('have.text', 'x')
    cy.pressKey('Backspace') // undoInputRule reverts only the rule transform
    cy.get('#editor code').should('not.exist')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('`x`'))
  })
})

export {}
