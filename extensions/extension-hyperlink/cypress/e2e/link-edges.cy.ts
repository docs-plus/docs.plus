/// <reference types="cypress" />

// The hyperlink mark is not inclusive, so a key typed at either edge stays
// plain, as in Google Docs. A link that starts its block is the left-edge
// case ProseMirror would otherwise extend, and autolink then stripped it.

const HREF = 'https://foreman.example'
const LINK = `<a href="${HREF}">${HREF}</a>`

// Positions come from the doc, because paragraph, heading and list depths differ.
const typeAtLinkEdge = (edge: 'start' | 'end', text: string): void => {
  cy.getEditor()
    .then((editor) => {
      let pos: number | undefined
      editor.state.doc.descendants((node, nodePos) => {
        if (pos !== undefined) return false
        if (node.isText && node.marks.some((mark) => mark.type.name === 'hyperlink')) {
          pos = edge === 'start' ? nodePos : nodePos + node.nodeSize
        }
      })
      if (pos === undefined) throw new Error('typeAtLinkEdge: no hyperlink text node')
      return pos
    })
    .then((pos) => cy.focusEditor(pos))
  cy.realType(text)
}

const expectLinkKept = (iconed: boolean): void => {
  cy.get('#editor a').should('have.length', 1).and('have.text', HREF).and('have.attr', 'href', HREF)
  cy.get('#editor a > .hyperlink-icon').should('have.length', iconed ? 1 : 0)
}

// Every case runs three times: plain links, a span icon with no network, and a map <img> icon.
const RUNS = [
  { query: '', label: '' },
  { query: 'icons=element', label: ' (icons=element)' },
  { query: 'icons=map', label: ' (icons=map)' }
]

RUNS.forEach(({ query, label }) => {
  describe(`link edges — typed text stays outside the link${label}`, () => {
    beforeEach(() => {
      cy.visitPlayground({ query })
    })

    // The map lists foreman.example, so its <img> icon must load before the first key.
    const setFixture = (html: string): void => {
      cy.setEditorContent(html)
      if (query === 'icons=map') cy.get('#editor a .hyperlink-icon').should('be.visible')
    }

    it('keeps a letter typed at the left edge plain when plain text comes before the link', () => {
      setFixture(`<p>question? ${LINK}</p>`)
      typeAtLinkEdge('start', 'Q')
      expectLinkKept(query !== '')
      cy.get('#editor p').first().should('have.text', `question? Q${HREF}`)
    })

    const blockStartFixtures = [
      { name: 'paragraph', html: `<p>${LINK} after</p>`, block: 'p' },
      { name: 'heading', html: `<h2>${LINK} after</h2>`, block: 'h2' },
      { name: 'list item', html: `<ul><li><p>${LINK} after</p></li></ul>`, block: 'li' }
    ]

    blockStartFixtures.forEach(({ name, html, block }) => {
      it(`keeps a letter typed before a link that starts a ${name} plain`, () => {
        setFixture(html)
        typeAtLinkEdge('start', 'Q')
        expectLinkKept(query !== '')
        cy.get(`#editor ${block}`).first().should('have.text', `Q${HREF} after`)
      })
    })

    it('keeps a letter typed at the right end plain when text follows the link', () => {
      setFixture(`<p>${LINK} after</p>`)
      typeAtLinkEdge('end', 'Q')
      expectLinkKept(query !== '')
      cy.get('#editor p').first().should('have.text', `${HREF}Q after`)
    })

    it('keeps a letter typed at the right end plain when the link ends its block', () => {
      setFixture(`<p>question? ${LINK}</p>`)
      typeAtLinkEdge('end', 'Q')
      expectLinkKept(query !== '')
      cy.get('#editor p').first().should('have.text', `question? ${HREF}Q`)
    })

    it('keeps a space typed at the right end plain and the link in place', () => {
      setFixture(`<p>question? ${LINK}</p>`)
      typeAtLinkEdge('end', ' ')
      expectLinkKept(query !== '')
      cy.getEditor().then((editor) => {
        expect(editor.state.doc.child(0).textContent).to.equal(`question? ${HREF} `)
      })
    })
  })
})

export {}
