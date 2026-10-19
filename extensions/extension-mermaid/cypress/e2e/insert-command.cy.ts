/// <reference types="cypress" />

// Failure mode: the caret fix in `insertMermaid` (the `from - 2` step back) breaks
// on a Tiptap bump, so the caret lands in the next paragraph.

const STARTER = [
  'flowchart TD',
  '  A[Start] --> B{Ready?}',
  '  B -- Yes --> C[Done]',
  '  B -- No --> A'
].join('\n')

function expectCaretAtSourceEnd(): void {
  cy.getEditor().should((editor) => {
    const { selection } = editor.state
    expect(selection.empty).to.equal(true)
    expect(selection.$from.parent.type.name).to.equal('codeBlock')
    expect(selection.$from.parent.attrs.language).to.equal('mermaid')
    expect(selection.$from.parent.textContent).to.equal(STARTER)
    expect(selection.$from.pos).to.equal(selection.$from.end())
  })
}

function docShape(): Cypress.Chainable<string[]> {
  return cy
    .getEditor()
    .then((editor) =>
      editor.state.doc.children.map((node) => `${node.type.name}:${node.textContent}`)
    )
}

describe('mermaid — insertMermaid', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('puts the caret at the end of the source when inserted mid-paragraph', () => {
    cy.setEditorContent('<p>Hello world</p>')
    cy.getEditor().then((editor) => {
      editor.chain().focus().setTextSelection(6).run()
      expect(editor.commands.insertMermaid()).to.equal(true)
    })
    expectCaretAtSourceEnd()
    docShape().should('deep.equal', ['paragraph:Hello', `codeBlock:${STARTER}`, 'paragraph: world'])
  })

  it('puts the caret at the end of the source when inserted at the start of a paragraph', () => {
    cy.setEditorContent('<p>Hello world</p>')
    cy.getEditor().then((editor) => {
      editor.chain().focus().setTextSelection(1).run()
      expect(editor.commands.insertMermaid()).to.equal(true)
    })
    expectCaretAtSourceEnd()
    docShape().should('deep.equal', [`codeBlock:${STARTER}`, 'paragraph:Hello world'])
  })

  it('refuses to insert inside a code block', () => {
    cy.setEditorContent('<pre><code class="language-js">const a = 1</code></pre>')
    cy.getEditor().then((editor) => {
      editor.chain().focus().setTextSelection(2).run()
      const before = editor.getJSON()
      expect(editor.can().insertMermaid()).to.equal(false)
      expect(editor.commands.insertMermaid()).to.equal(false)
      expect(editor.getJSON()).to.deep.equal(before)
    })
  })
})

export {}
