import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import { section, paragraph, heading } from '../../../../../fixtures/docMaker'

// Document with potential validation issues after conversion
const EdgeCaseDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Parent Heading', [
        paragraph(TEST_CONTENT.short),
        // This is the heading we'll convert
        heading(3, 'Middle Heading To Convert', [
          paragraph(TEST_CONTENT.short),
          // This will become direct child of Parent Heading after conversion
          heading(4, 'Child Heading', [
            paragraph(TEST_CONTENT.short),
            // Deeply nested heading that will be restructured
            heading(5, 'Grandchild Heading', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(3, 'Sibling Heading', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Another Parent', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Another Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Parent in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Non-Sequential Child', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

describe('Convert Heading to Text with Validation Edge Cases', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'heading-to-text-validation-doc' })
  })

  it('should create a document with potential validation edge cases', () => {
    cy.validateDocumentStructure(EdgeCaseDocumentStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })

    cy.createDocument(EdgeCaseDocumentStructure)
    // Wait for document to fully render
    cy.wait(1000)
  })

  it('should convert a heading with children to normal text', () => {
    // Position cursor in the heading we want to convert
    cy.putPosCaretInHeading(3, 'Middle Heading To Convert', 'start')

    // Use Meta+Option+0 shortcut to convert heading to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)
  })

  it('should verify heading was converted to paragraph', () => {
    // Verify the heading no longer exists
    cy.get('.heading .title').contains('Middle Heading To Convert').should('not.exist')

    // Verify there's now a paragraph with that text
    cy.get('p').contains('Middle Heading To Convert').should('exist')
  })

  it('should verify child headings were properly restructured', () => {
    // Child Heading should now be under Parent Heading
    cy.get('.heading[level="2"]')
      .contains('Parent Heading')
      .closest('.heading')
      .find('.heading[level="4"]')
      .contains('Child Heading')
      .should('exist')

    // Grandchild should still be child of Child Heading
    cy.get('.heading[level="4"]')
      .contains('Child Heading')
      .closest('.heading')
      .find('.heading[level="5"]')
      .contains('Grandchild Heading')
      .should('exist')
  })

  it('should verify dome structure', () => {
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).have.length(0)
    })
  })
})
