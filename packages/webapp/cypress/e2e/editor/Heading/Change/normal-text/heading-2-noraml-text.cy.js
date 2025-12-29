/* eslint-disable no-undef */
import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import { section, paragraph, heading } from '../../../../../fixtures/docMaker'

// Complex nested document structure
const ComplexDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Background', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Historical Context', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Key Concepts', [
          paragraph(TEST_CONTENT.short),
          // This is the heading we'll convert to normal text
          heading(4, 'Conversion Target', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Implementation Details', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Advanced Topics', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Deep Nested Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Another Branch', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Define the expected document structure after conversion
const expectedStructureAfterConversion = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Background', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Historical Context', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Key Concepts', [
          paragraph(TEST_CONTENT.short),
          // Heading converted to paragraph
          paragraph('Conversion Target'),
          paragraph(TEST_CONTENT.short),
          heading(4, 'Implementation Details', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Advanced Topics', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Deep Nested Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Another Branch', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

describe('Convert Heading to Normal Text', { testIsolation: false }, () => {
  before(() => {
    // Use clearDoc: true to ensure fresh start each run
    cy.visitEditor({ persist: false, docName: 'heading-to-normal-text-doc', clearDoc: true })
  })

  it('should create a complex document with nested headings', () => {
    // Create the document first
    cy.createDocument(ComplexDocumentStructure)
    cy.wait(500) // Wait for DOM to settle

    // Then validate the structure
    cy.validateDocumentStructure(ComplexDocumentStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should convert a heading to normal text using keyboard shortcut', () => {
    // Position cursor in the heading we want to convert
    cy.putPosCaretInHeading(4, 'Conversion Target', 'start')

    // Use Meta+Option+0 shortcut to convert heading to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)
  })

  it('should verify heading was converted to paragraph', () => {
    // Verify the heading no longer exists
    cy.get('.heading .title').contains('Conversion Target').should('not.exist')

    // Verify there's now a paragraph with that text
    cy.get('p').contains('Conversion Target').should('exist')

    // Validate structure after conversion
    cy.validateDocumentStructure(expectedStructureAfterConversion).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should validate DOM structure directly', () => {
    // Validate document structure by traversing DOM elements
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      console.log({ result })
      expect(result.valid).to.be.true
      expect(result.errors).have.length(0)
    })

    // Additional specific checks for the converted structure
    cy.get('.docy_editor .heading[level="1"]').should('have.length', 2)

    // Verify Introduction heading structure
    cy.get('.heading[level="2"]')
      .contains('Introduction')
      .closest('.heading[level="2"]')
      .within(() => {
        // Check Background is still a level 3 heading
        cy.get('.heading[level="3"]').contains('Background').should('exist')

        // Check Key Concepts is still a level 3 heading
        cy.get('.heading[level="3"]')
          .contains('Key Concepts')
          .closest('.heading[level="3"]')
          .within(() => {
            // Check "Conversion Target" is now a paragraph, not a heading
            cy.get('.heading[level="4"] .title').contains('Conversion Target').should('not.exist')
            cy.get('p').contains('Conversion Target').should('exist')

            // Check Implementation Details is still a level 4 heading
            cy.get('.heading[level="4"]').contains('Implementation Details').should('exist')
          })
      })

    // Verify Advanced Topics heading still exists
    cy.get('.heading[level="2"] .title').contains('Advanced Topics').should('exist')
  })
})
