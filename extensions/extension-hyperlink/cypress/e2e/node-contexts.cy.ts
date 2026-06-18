/// <reference types="cypress" />

/**
 * Hyperlink behavior inside non-paragraph node contexts: code blocks
 * reject autolink, headings keep their structure, list items survive the
 * Mod-k create flow, and the mark never continues past an Enter split.
 */

// Verbatim JSON text inserts (HTML parsing collapses edge whitespace), with
// the trailing space on its own tick for the autolink boundary. Caret targets
// the FIRST block's end — StarterKit's TrailingNode appends an empty trailing
// paragraph, so `focus('end')` would type there, not in the block under test.
const insertThenSpace = (text: string): void => {
  cy.getEditor().then((editor) => {
    const endOfFirstBlock = editor.state.doc.child(0).nodeSize - 1
    editor.chain().focus(endOfFirstBlock).insertContent({ type: 'text', text }).run()
  })
  cy.getEditor().then((editor) => {
    editor.chain().insertContent({ type: 'text', text: ' ' }).run()
  })
}

describe('node contexts — codeBlock, heading, listItem, Enter split', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('does not autolink a URL typed inside a code block', () => {
    cy.setEditorContent('<pre><code></code></pre>')
    insertThenSpace('https://example.com')
    cy.get('#editor a').should('not.exist')
    cy.get('#editor pre code').should('contain.text', 'https://example.com')
  })

  it('autolink inside a heading keeps a single heading with the link nested in it', () => {
    cy.setEditorContent('<h2>Docs at</h2>')
    insertThenSpace(' google.com')
    cy.get('#editor h2').should('have.length', 1)
    cy.get('#editor h2 > a').should('have.attr', 'href', 'https://google.com')
    cy.get('#editor h2 > a').should('contain.text', 'google.com')
    cy.get('#editor p a').should('not.exist')
  })

  it('Mod-k create flow inside a list item keeps the list structure', () => {
    cy.setEditorContent('<ul><li><p>alpha target omega</p></li></ul>')
    cy.selectText('target')
    cy.pressModK()
    cy.get('.hyperlink-create-popover input[name="hyperlink-url"]').type(
      'https://example.com{enter}'
    )
    cy.get('.hyperlink-create-popover').should('not.exist')
    cy.get('#editor ul').should('have.length', 1)
    cy.get('#editor ul > li').should('have.length', 1)
    cy.get('#editor ul li a')
      .should('have.attr', 'href', 'https://example.com')
      .and('contain.text', 'target')
    cy.get('#editor ul li').should('contain.text', 'alpha target omega')
  })

  it('the link mark does not continue past Enter (keepOnSplit: false)', () => {
    cy.setEditorContent('<p><a href="https://example.com">link</a></p>')
    cy.getEditor().then((editor) => {
      editor.commands.focus('end')
    })
    // Keymap handlers fire from a synthetic keydown (ProseMirror handles
    // the event itself); the split happens before the typed char lands.
    cy.get('#editor [contenteditable="true"]').trigger('keydown', {
      key: 'Enter',
      keyCode: 13,
      bubbles: true
    })
    cy.get('#editor p').should('have.length', 2)
    cy.realType('x')
    cy.get('#editor a').should('have.length', 1)
    cy.get('#editor p').eq(1).should('contain.text', 'x')
    cy.get('#editor p').eq(1).find('a').should('not.exist')
  })
})

export {}
