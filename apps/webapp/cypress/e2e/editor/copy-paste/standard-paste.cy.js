import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Standard Paste (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'standard-paste-test', persist: true })
  })

  it('should preserve heading structure on copy-paste', () => {
    const doc = {
      sections: [
        section('Paste Test', [
          heading(2, 'Sub Heading', [paragraph('Some content')]),
          paragraph('A paragraph')
        ])
      ]
    }

    cy.createDocument(doc)
    cy.wait(300)

    // Verify initial structure
    cy.get('h1[data-toc-id]').should('contain', 'Paste Test')
    cy.get('h2[data-toc-id]').should('contain', 'Sub Heading')

    // Meta+c does not reach the OS clipboard under headless Electron, so carry
    // the copy in a DataTransfer. handlePaste and the HTML parse path still run.
    cy.window().then((win) => cy.wrap(win._editor.getHTML()).as('copiedHtml'))

    cy.clearEditor()
    cy.wait(200)

    cy.get('@copiedHtml').then((copiedHtml) => {
      cy.get('.docy_editor > .tiptap.ProseMirror').click()
      cy.pasteWithMimeTypes({
        'text/html': copiedHtml,
        'text/plain': 'Paste Test\n\nSub Heading\n\nSome content\n\nA paragraph'
      })
    })
    cy.wait(500)

    // Verify structure preserved
    cy.get('h1[data-toc-id]').should('exist')
    cy.contains('h2[data-toc-id]', 'Sub Heading').should('exist')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'Some content')
  })

  it('should handle paste of plain text into heading', () => {
    cy.clearEditor()
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Test Title{enter}')
    cy.get('.docy_editor > .tiptap.ProseMirror').type('## My Heading{enter}')

    // Type some plain text
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Plain paragraph text')

    // Verify the heading and paragraph are separate
    cy.get('h2[data-toc-id]').should('contain', 'My Heading')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'Plain paragraph text')
  })
})
