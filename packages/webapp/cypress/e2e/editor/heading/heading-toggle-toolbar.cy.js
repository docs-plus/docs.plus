/* eslint-disable no-undef */

describe('Heading Toolbar Toggle (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'heading-toggle-toolbar-test', persist: true })
    cy.clearEditor()
  })

  it('toggles heading levels via Alt+Meta+2–6', () => {
    const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
    editor.type('Test Document{enter}')
    editor.type('Toggle Me')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '2'])
    cy.wait(200)
    cy.get('h2[data-toc-id]').contains('Toggle Me').should('exist')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '3'])
    cy.wait(200)
    cy.get('h3[data-toc-id]').contains('Toggle Me').should('exist')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '4'])
    cy.wait(200)
    cy.get('h4[data-toc-id]').contains('Toggle Me').should('exist')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '5'])
    cy.wait(200)
    cy.get('h5[data-toc-id]').contains('Toggle Me').should('exist')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '6'])
    cy.wait(200)
    cy.get('h6[data-toc-id]').contains('Toggle Me').should('exist')
  })

  it('converts heading to paragraph with Alt+Meta+0', () => {
    const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
    editor.type('Test Document{enter}')
    editor.type('Convert Me')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '2'])
    cy.wait(200)
    cy.get('h2[data-toc-id]').contains('Convert Me').should('exist')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '0'])
    cy.wait(200)

    cy.get(':is(h1, h2, h3, h4, h5, h6)[data-toc-id]').contains('Convert Me').should('not.exist')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'Convert Me')
  })

  it('does not demote the document title from H1', () => {
    const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
    editor.type('My Title')

    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Alt', 'Meta', '3'])
    cy.wait(200)

    cy.get('h1[data-toc-id]').first().should('contain', 'My Title')
  })
})
