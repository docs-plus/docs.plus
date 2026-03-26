/* eslint-disable no-undef */

describe('Heading Input Rules (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'heading-input-rules-test', persist: true })
    cy.clearEditor()
  })

  it('creates H1 via markdown # and H2–H6 via ##–######', () => {
    const editor = cy.get('.docy_editor > .tiptap.ProseMirror')

    editor.type('Test Document{enter}')
    editor.type('# Via Markdown H1{enter}')
    cy.get('h1[data-toc-id]').contains('Via Markdown H1').should('exist')

    editor.type('## Second Level{enter}')
    cy.get('h2[data-toc-id]').contains('Second Level').should('exist')

    editor.type('### Third Level{enter}')
    cy.get('h3[data-toc-id]').contains('Third Level').should('exist')

    editor.type('#### Fourth Level{enter}')
    cy.get('h4[data-toc-id]').contains('Fourth Level').should('exist')

    editor.type('##### Fifth Level{enter}')
    cy.get('h5[data-toc-id]').contains('Fifth Level').should('exist')

    editor.type('###### Sixth Level{enter}')
    cy.get('h6[data-toc-id]').contains('Sixth Level').should('exist')
  })

  it('does not create a heading for seven or more hashes', () => {
    const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
    editor.type('Test Document{enter}')
    editor.type('####### Not A Heading')

    cy.get('h1[data-toc-id]').should('have.length', 1)
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', '####### Not A Heading')
  })

  it('assigns non-empty data-toc-id on every heading', () => {
    const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
    editor.type('Title{enter}')
    editor.type('## Heading Two{enter}')
    editor.type('### Heading Three{enter}')

    cy.get(':is(h1, h2, h3, h4, h5, h6)[data-toc-id]').each(($el) => {
      expect($el.attr('data-toc-id')).to.be.a('string').and.have.length.greaterThan(0)
    })
  })
})
