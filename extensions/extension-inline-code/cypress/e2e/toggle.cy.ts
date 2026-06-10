/// <reference types="cypress" />

// Selection toggle on/off + the B2 fix (collapsed-caret toggle-off). Driven via
// the toggleInlineCode command — the toolbar button path. Backtick input rules
// live in input-rule.cy.ts.

describe('inline code — toggle', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('wraps a selection in inline code', () => {
    cy.setEditorContent('<p>hello world</p>')
    cy.selectText('hello')
    cy.toggleInlineCode()
    cy.get('#editor code').should('have.text', 'hello')
    cy.getEditor().should((e) => expect(e.getHTML()).to.contain('<code>hello</code>'))
  })

  it('toggles the mark back off across a selection', () => {
    cy.setEditorContent('<p>hello world</p>')
    cy.selectText('hello')
    cy.toggleInlineCode()
    cy.get('#editor code').should('exist')
    cy.selectText('hello')
    cy.toggleInlineCode()
    cy.get('#editor code').should('not.exist')
  })

  it('extends the mark across a partly-marked selection', () => {
    cy.setEditorContent('<p>one two three</p>')
    cy.selectText('two')
    cy.toggleInlineCode()
    // "two" is now its own coded text node, so re-select the whole paragraph.
    cy.getEditor().then((e) => e.chain().focus().selectAll().run())
    cy.toggleInlineCode()
    cy.get('#editor code').should('have.text', 'one two three')
  })

  it('B2: toggling off from a collapsed caret clears code mode for the next char', () => {
    cy.setEditorContent('<p>code</p>')
    cy.selectText('code')
    cy.toggleInlineCode()
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
    cy.setCaretAfter('code') // collapsed caret at the right edge of the mark
    cy.toggleInlineCode()
    // Original bug: removeMark over an empty range was a no-op, so code mode
    // stuck. toggleMark clears the stored mark, so the next char would be plain.
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(false))
  })
})

export {}
