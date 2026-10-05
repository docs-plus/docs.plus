/// <reference types="cypress" />

// The hyperlink mark is not inclusive, so a key typed at either edge stays
// plain, as in Google Docs. A link that starts its block is the left-edge
// case ProseMirror would otherwise extend, and autolink then stripped it.

const HREF = 'https://foreman.example'
const LINK = `<a href="${HREF}">${HREF}</a>`

// Positions come from the doc, because paragraph, heading and list depths differ.
const typeAtLinkEdge = (edge: 'start' | 'end', text: string): void => {
  cy.getEditor().then((editor) => {
    let pos: number | undefined
    editor.state.doc.descendants((node, nodePos) => {
      if (pos !== undefined) return false
      if (node.isText && node.marks.some((mark) => mark.type.name === 'hyperlink')) {
        pos = edge === 'start' ? nodePos : nodePos + node.nodeSize
      }
    })
    expect(pos, 'hyperlink text node').to.be.a('number')
    editor.commands.focus(pos)
  })
  cy.get('#editor [contenteditable="true"]').should('have.focus')
  cy.realType(text)
}

const expectLinkKept = (): void => {
  cy.get('#editor a').should('have.length', 1).and('have.text', HREF).and('have.attr', 'href', HREF)
}

describe('link edges — typed text stays outside the link', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('keeps a letter typed at the left edge plain when plain text comes before the link', () => {
    cy.setEditorContent(`<p>question? ${LINK}</p>`)
    typeAtLinkEdge('start', 'Q')
    expectLinkKept()
    cy.get('#editor p').first().should('have.text', `question? Q${HREF}`)
  })

  const blockStartFixtures = [
    { name: 'paragraph', html: `<p>${LINK} after</p>`, block: 'p' },
    { name: 'heading', html: `<h2>${LINK} after</h2>`, block: 'h2' },
    { name: 'list item', html: `<ul><li><p>${LINK} after</p></li></ul>`, block: 'li' }
  ]

  blockStartFixtures.forEach(({ name, html, block }) => {
    it(`keeps a letter typed before a link that starts a ${name} plain`, () => {
      cy.setEditorContent(html)
      typeAtLinkEdge('start', 'Q')
      expectLinkKept()
      cy.get(`#editor ${block}`).first().should('have.text', `Q${HREF} after`)
    })
  })

  it('keeps a letter typed at the right end plain when text follows the link', () => {
    cy.setEditorContent(`<p>${LINK} after</p>`)
    typeAtLinkEdge('end', 'Q')
    expectLinkKept()
    cy.get('#editor p').first().should('have.text', `${HREF}Q after`)
  })

  it('keeps a letter typed at the right end plain when the link ends its block', () => {
    cy.setEditorContent(`<p>question? ${LINK}</p>`)
    typeAtLinkEdge('end', 'Q')
    expectLinkKept()
    cy.get('#editor p').first().should('have.text', `question? ${HREF}Q`)
  })

  it('keeps a space typed at the right end plain and the link in place', () => {
    cy.setEditorContent(`<p>question? ${LINK}</p>`)
    typeAtLinkEdge('end', ' ')
    expectLinkKept()
    cy.getEditor().then((editor) => {
      expect(editor.state.doc.child(0).textContent).to.equal(`question? ${HREF} `)
    })
  })
})

export {}
