import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import {
  section,
  paragraph,
  heading,
  listItem,
  orderedList,
  bulletList
} from '../../../../../fixtures/docMaker'

// Complex document structure with mixed content types
const MixedContentDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Mixed Content Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Mixed Content Heading', [
        paragraph('First paragraph before lists'),
        // Add some list content - this would be handled by the proper list creation function
        // in a real implementation but simplified here for clarity

        bulletList([
          listItem('First bullet point', 0),
          listItem('Second bullet point', 1),
          listItem('Third bullet point', 0)
        ]),
        paragraph('Regular paragraph between lists'),
        orderedList([listItem('First ordered item', 0), listItem('Second ordered item', 1)]),
        heading(3, 'Nested Mixed Content', [
          paragraph(TEST_CONTENT.short),
          bulletList([listItem('Another bullet list', 0), listItem('Another bullet point', 1)]),
          paragraph(TEST_CONTENT.short),
          heading(4, 'Deep Heading To Select', [
            paragraph(TEST_CONTENT.short),
            paragraph('More content after heading')
          ])
        ])
      ])
    ]),
    section('Partial Selection Section', [
      paragraph('Introduction paragraph for partial selection testing'),
      heading(2, 'Partial Selection Parent', [
        paragraph('Content before partial selection'),
        heading(3, 'First Child', [paragraph('This will be partially selected')]),
        heading(3, 'Middle Child', [paragraph('This will be completely selected')]),
        heading(3, 'Last Child', [
          paragraph('This will be partially selected'),
          paragraph('Content after partial selection')
        ])
      ])
    ])
  ]
}

// Expected structure after partial selection conversion
const partialSelectionExpectedStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Mixed Content Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Mixed Content Heading', [
        paragraph('First paragraph before lists'),
        bulletList([
          listItem('First bullet point', 0),
          listItem('Second bullet point', 1),
          listItem('Third bullet point', 0)
        ]),
        paragraph('Regular paragraph between lists'),
        orderedList([listItem('First ordered item', 0), listItem('Second ordered item', 1)]),
        heading(3, 'Nested Mixed Content', [
          paragraph(TEST_CONTENT.short),
          bulletList([listItem('Another bullet list', 0), listItem('Another bullet point', 1)]),
          heading(4, 'Deep Heading To Select', [
            paragraph(TEST_CONTENT.short),
            paragraph('More content after heading')
          ])
        ])
      ])
    ]),
    section('Partial Selection Section', [
      paragraph('Introduction paragraph for partial selection testing'),
      heading(2, 'Partial Selection Parent', [
        paragraph('Content before partial selection'),
        // First heading partially converted
        paragraph('First Child'),
        paragraph('This will be partially selected'),
        // Middle heading fully converted
        paragraph('Middle Child'),
        paragraph('This will be completely selected'),
        // Last heading partially converted
        paragraph('Last Child'),
        paragraph('This will be partially selected'),
        paragraph('Content after partial selection')
      ])
    ])
  ]
}

// Expected structure after mixed content conversion
const mixedContentExpectedStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Mixed Content Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Mixed Content Heading', [
        paragraph('First paragraph before lists'),
        bulletList([
          listItem('First bullet point', 0),
          listItem('Second bullet point', 1),
          listItem('Third bullet point', 0)
        ]),
        paragraph('Regular paragraph between lists'),
        orderedList([listItem('First ordered item', 0), listItem('Second ordered item', 1)]),
        heading(3, 'Nested Mixed Content', [
          paragraph(TEST_CONTENT.short),
          bulletList([listItem('Another bullet list', 0), listItem('Another bullet point', 1)]),
          // Converted to paragraph
          paragraph('Deep Heading To Select'),
          paragraph(TEST_CONTENT.short),
          paragraph('More content after heading')
        ])
      ])
    ]),
    section('Partial Selection Section', [
      paragraph('Introduction paragraph for partial selection testing'),
      heading(2, 'Partials Selection Parent', [
        paragraph('Content before partial selection'),
        heading(3, 'First Child', [paragraph('This will be partially selected')]),
        heading(3, 'Middle Child', [paragraph('This will be completely selected')]),
        heading(3, 'Last Child', [
          paragraph('This will be partially selected'),
          paragraph('Content after partial selection')
        ])
      ])
    ])
  ]
}

describe('Convert Complex Selections to Normal Text', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'heading-partial-selection-to-normal' })
  })

  it('should create a complex document with mixed content types', () => {
    // Create the document
    cy.createDocument(MixedContentDocumentStructure)

    // Validate initial document structure
    cy.validateDocumentStructure(MixedContentDocumentStructure).then((result) => {
      console.log({ result })
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should convert a heading within list content using selection', () => {
    // Create selection that includes a deep heading
    cy.createSelection({
      startHeading: { level: 4, title: 'Deep Heading To Select' },
      startPosition: 'start',
      endHeading: { level: 4, title: 'Deep Heading To Select' },
      endPosition: 'end'
    })

    // Use Meta+Option+0 shortcut to convert heading to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)

    // Verify the heading was converted to normal text
    cy.get('.heading .title').contains('Deep Heading To Select').should('not.exist')
    cy.get('p').contains('Deep Heading To Select').should('exist')

    // Validate structure after conversion
    cy.validateDocumentStructure(mixedContentExpectedStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should handle partial selection across multiple headings', () => {
    // Create selection that spans multiple headings but starts and ends in the middle
    cy.createSelection({
      startHeading: { level: 3, title: 'First Child' },
      startPosition: 0, // At the beginning of the heading title
      endHeading: { level: 3, title: 'Last Child' },
      endPosition: 'end'
    })

    // Use Meta+Option+0 shortcut to convert headings to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)

    // Verify the headings were converted to normal text
    cy.get('.heading[level="3"] .title').contains('First Child').should('not.exist')
    cy.get('.heading[level="3"] .title').contains('Middle Child').should('not.exist')
    cy.get('.heading[level="3"] .title').contains('Last Child').should('not.exist')

    cy.get('p').contains('First Child').should('exist')
    cy.get('p').contains('Middle Child').should('exist')
    cy.get('p').contains('Last Child').should('exist')

    // Validate structure after conversion
    cy.validateDocumentStructure(partialSelectionExpectedStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should validate DOM structure remains coherent after complex conversions', () => {
    // Validate document structure by traversing DOM elements
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).have.length(0)
    })

    // Additional verification of specific elements
    cy.get('.docy_editor').within(() => {
      // Check section structure
      cy.get('.heading[level="1"]').should('have.length', 2)

      // Check the "Mixed Content Section"
      cy.get('.heading[level="1"]')
        .contains('Mixed Content Section')
        .closest('.heading[level="1"]')
        .within(() => {
          // Verify converted heading is now a paragraph
          cy.get('.heading .title').should('not.contain', 'Deep Heading To Select')
          cy.get('p').contains('Deep Heading To Select').should('exist')
        })

      // Check the "Partial Selection Section"
      cy.get('.heading[level="1"]')
        .contains('Partial Selection Section')
        .closest('.heading[level="1"]')
        .within(() => {
          // Verify all child headings were converted to paragraphs
          cy.get('.heading[level="3"]').should('not.exist')
          cy.get('p').contains('First Child').should('exist')
          cy.get('p').contains('Middle Child').should('exist')
          cy.get('p').contains('Last Child').should('exist')
        })
    })
  })
})
