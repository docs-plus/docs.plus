import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Full Document Paste (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'full-doc-paste-test', persist: true })
  })

  it('should handle full-doc paste (⌘A→⌘V) correctly', () => {
    const doc = {
      sections: [
        section('My Document Title', [
          heading(2, 'Introduction', [paragraph('Intro content here')]),
          heading(2, 'Details', [paragraph('Detail content here')]),
          heading(3, 'Sub Detail', [paragraph('Sub detail content')])
        ])
      ]
    }

    cy.createDocument(doc)
    cy.wait(500)

    // Select all
    cy.get('.docy_editor > .tiptap.ProseMirror').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
    cy.wait(100)

    // Copy
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'c'])
    cy.wait(200)

    // Select all again and paste over
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
    cy.wait(100)
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'v'])
    cy.wait(500)

    // Verify document reconstructed correctly
    // BC-1: First node must be H1
    cy.get('.docy_editor > .tiptap > h1[data-toc-id]').first().should('exist')

    // Heading structure preserved
    cy.get('h2[data-toc-id]').should('have.length', 2)
    cy.get('h3[data-toc-id]').should('have.length', 1)

    // Content preserved
    cy.get('.docy_editor .tiptap.ProseMirror').should('contain', 'Intro content')
    cy.get('.docy_editor .tiptap.ProseMirror').should('contain', 'Detail content')
    cy.get('.docy_editor .tiptap.ProseMirror').should('contain', 'Sub detail content')
  })

  it('should maintain H1 as title after full-doc paste', () => {
    cy.clearEditor()
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Original Title{enter}')
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Some body text')
    cy.wait(300)

    // Select all, copy, select all, paste
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'c'])
    cy.wait(100)
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'v'])
    cy.wait(500)

    // BC-1: Title must remain H1
    cy.get('h1[data-toc-id]').should('have.length', 1)
    cy.get('h1[data-toc-id]').should('contain', 'Original Title')
  })
})
