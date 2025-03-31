import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import { section, paragraph, heading } from '../../../../../fixtures/docMaker'

// Complex nested document structure for testing selections
const ComplexDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Heading', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Nested Heading A', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Deep Heading 1', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Deep Heading 2', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Nested Heading B', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Target Heading', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Another Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Heading', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Another Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Multiple Selection Test', [
        paragraph('First paragraph in section'),
        paragraph('Middle paragraph with important content'),
        paragraph('Last paragraph in this section'),
        heading(3, 'First Target', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Second Target', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Third Target', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Define expected structures after conversion
const singleHeadingExpectedStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Heading', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Nested Heading A', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Deep Heading 1', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Deep Heading 2', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Nested Heading B', [
          paragraph(TEST_CONTENT.short),
          // Converted to paragraph
          paragraph('Target Heading'),
          paragraph(TEST_CONTENT.short),
          heading(4, 'Another Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Heading', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Another Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Multiple Selection Test', [
        paragraph('First paragraph in section'),
        paragraph('Middle paragraph with important content'),
        paragraph('Last paragraph in this section'),
        heading(3, 'First Target', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Second Target', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Third Target', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

const multipleHeadingsExpectedStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Heading', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Nested Heading A', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Deep Heading 1', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Deep Heading 2', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Nested Heading B', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Target Heading', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Another Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Heading', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Another Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Multiple Selection Test', [
        paragraph('First paragraph in section'),
        paragraph('Middle paragraph with important content'),
        paragraph('Last paragraph in this section'),
        // All three headings converted to paragraphs
        paragraph('First Target'),
        paragraph(TEST_CONTENT.short),
        paragraph('Second Target'),
        paragraph(TEST_CONTENT.short),
        paragraph('Third Target'),
        paragraph(TEST_CONTENT.short)
      ])
    ])
  ]
}

describe('Convert Selected Headings to Normal Text', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'heading-selection-to-normal-text' })
  })

  it('should create a complex document with nested headings', () => {
    // Create the document
    cy.createDocument(ComplexDocumentStructure)

    // Validate initial document structure
    cy.validateDocumentStructure(ComplexDocumentStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should convert a single heading to normal text using selection and keyboard shortcut', () => {
    // Create selection that includes a single heading
    cy.createSelection({
      startHeading: { level: 4, title: 'Target Heading' },
      startPosition: 'start',
      endHeading: { level: 4, title: 'Target Heading' },
      endPosition: 'end'
    })

    // Use Meta+Option+0 shortcut to convert heading to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)

    // Verify the heading was converted to normal text
    cy.get('.heading[level="4"] .title').contains('Target Heading').should('not.exist')
    cy.get('p').contains('Target Heading').should('exist')

    // Validate structure after conversion
    cy.validateDocumentStructure(singleHeadingExpectedStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should convert multiple headings to normal text when selection spans multiple headings', () => {
    // Create selection that spans multiple headings
    cy.createSelection({
      startHeading: { level: 3, title: 'First Target' },
      startPosition: 'start',
      endHeading: { level: 3, title: 'Third Target' },
      endPosition: 'end'
    })

    // Use Meta+Option+0 shortcut to convert headings to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)

    // Verify all headings were converted
    cy.get('.heading[level="3"] .title').contains('First Target').should('not.exist')
    cy.get('.heading[level="3"] .title').contains('Second Target').should('not.exist')
    cy.get('.heading[level="3"] .title').contains('Third Target').should('not.exist')

    cy.get('p').contains('First Target').should('exist')
    cy.get('p').contains('Second Target').should('exist')
    cy.get('p').contains('Third Target').should('exist')

    // Validate structure after conversion
    cy.validateDocumentStructure(multipleHeadingsExpectedStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should validate DOM structure directly after conversions', () => {
    // Validate document structure by traversing DOM elements
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).have.length(0)
    })
  })
})
