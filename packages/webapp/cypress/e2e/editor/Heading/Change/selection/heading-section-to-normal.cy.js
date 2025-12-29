/* eslint-disable no-undef */
import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import { section, paragraph, heading } from '../../../../../fixtures/docMaker'

// Document structure with multiple sections and nested headings
const MultiSectionDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Section Heading 1', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Nested Heading 1.1', [paragraph('Content under nested heading 1.1')])
      ]),
      heading(2, 'First Section Heading 2', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Middle Section To Convert', [
      paragraph('This is content in the middle section that will be converted to normal text'),
      heading(2, 'Middle Section Heading 1', [
        paragraph('Content under middle section heading 1'),
        heading(3, 'Nested Middle Heading', [
          paragraph('Deeply nested content in middle section'),
          heading(4, 'Very Deep Heading', [paragraph('Very deep content')])
        ])
      ]),
      heading(2, 'Middle Section Heading 2', [
        paragraph('More middle section content'),
        heading(3, 'Another Nested Heading', [paragraph('More nested content')])
      ])
    ]),
    section('Third Section level 1', [
      paragraph('Content in third section begins here'),
      heading(2, 'Third Section Heading 1', [
        paragraph('Content under third section heading 1'),
        heading(3, 'Third Section Nested 1', [paragraph('Selection will start here')])
      ]),
      heading(2, 'Third Section Heading 2', [
        paragraph('More content in third section'),
        heading(3, 'Third Section Nested 2', [paragraph('More nested content in third section')])
      ])
    ])
  ]
}

// Expected structure after converting middle section to normal text
const middleSectionConvertedStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Section Heading 1', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Nested Heading 1.1', [paragraph('Content under nested heading 1.1')])
      ]),
      heading(2, 'First Section Heading 2', [paragraph(TEST_CONTENT.short)]),
      // Middle section becomes paragraphs under First Section
      paragraph('Middle Section To Convert'),
      paragraph('This is content in the middle section that will be converted to normal text'),
      paragraph('Middle Section Heading 1'),
      paragraph('Content under middle section heading 1'),
      paragraph('Nested Middle Heading'),
      paragraph('Deeply nested content in middle section'),
      paragraph('Very Deep Heading'),
      paragraph('Very deep content'),
      paragraph('Middle Section Heading 2'),
      paragraph('More middle section content'),
      paragraph('Another Nested Heading'),
      paragraph('More nested content')
    ]),
    section('Third Section level 1', [
      paragraph('Content in third section begins here'),
      heading(2, 'Third Section Heading 1', [
        paragraph('Content under third section heading 1'),
        heading(3, 'Third Section Nested 1', [paragraph('Selection will start here')])
      ]),
      heading(2, 'Third Section Heading 2', [
        paragraph('More content in third section'),
        heading(3, 'Third Section Nested 2', [paragraph('More nested content in third section')])
      ])
    ])
  ]
}

// Expected structure after converting content spanning from section 3 to section 2
const crossSectionSelectionStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Section Heading 1', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Nested Heading 1.1', [paragraph('Content under nested heading 1.1')])
      ]),
      heading(2, 'First Section Heading 2', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Middle Section To Convert', [
      paragraph('This is content in the middle section that will be converted to normal text'),
      heading(2, 'Middle Section Heading 1', [
        paragraph('Content under middle section heading 1'),
        heading(3, 'Nested Middle Heading', [
          paragraph('Deeply nested content in middle section'),
          // This and all nested content becomes paragraphs
          paragraph('Very Deep Heading'),
          paragraph('Very deep content')
        ])
      ]),
      heading(2, 'Middle Section Heading 2', [
        paragraph('More middle section content'),
        // This and all content becomes paragraphs
        paragraph('Another Nested Heading'),
        paragraph('More nested content')
      ])
    ]),
    section('Third Section level 1', [
      paragraph('Content in third section begins here'),
      heading(2, 'Third Section Heading 1', [
        paragraph('Content under third section heading 1'),
        // This and all content becomes paragraphs
        paragraph('Third Section Nested 1'),
        paragraph('Selection will start here')
      ]),
      heading(2, 'Third Section Heading 2', [
        paragraph('More content in third section'),
        heading(3, 'Third Section Nested 2', [paragraph('More nested content in third section')])
      ])
    ])
  ]
}

describe(
  'Convert Section and Cross-Section Selections to Normal Text',
  { testIsolation: false },
  () => {
    before(() => {
      cy.visitEditor({ persist: true, docName: 'heading-section-to-normal' })
    })

    it('should create a document with multiple sections and nested headings', () => {
      // Create the document
      cy.createDocument(MultiSectionDocumentStructure)

      // Validate initial document structure
      cy.validateDomStructure().then((result) => {
        expect(result.valid).to.be.true
        expect(result.errors).to.have.length(0)
      })
    })

    it('should convert a middle section (level 1 heading) to normal text', () => {
      // Create selection for the middle section
      cy.createSelection({
        startHeading: { level: 1, title: 'Middle Section To Convert' },
        startPosition: 'start',
        endHeading: { level: 1, title: 'Middle Section To Convert' },
        endPosition: 'end'
      })

      // Use Meta+Option+0 shortcut to convert section to normal text
      cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

      // Wait for changes to apply
      cy.wait(500)

      // Verify the section was converted to normal text
      cy.get('.heading[level="1"] .title').contains('Middle Section To Convert').should('not.exist')
      cy.get('p').contains('Middle Section To Convert').should('exist')

      // Validate structure after conversion
      cy.validateDomStructure(middleSectionConvertedStructure).then((result) => {
        expect(result.valid).to.be.true
        expect(result.errors).to.have.length(0)
      })

      // Verify section count is now 2 instead of 3
      cy.get('.heading[level="1"]').should('have.length', 2)
    })

    it('should restore the document for the next test', () => {
      // Reload the editor to start fresh
      cy.visitEditor({ docName: 'heading-section-to-normal-fresh' })

      // Create the document again
      cy.createDocument(MultiSectionDocumentStructure)

      // Validate document structure
      cy.validateDomStructure().then((result) => {
        expect(result.valid).to.be.true
        expect(result.errors).to.have.length(0)
      })
    })

    it('should convert headings in a selection spanning from section 3 to section 2', () => {
      // Create a selection that starts in section 3 and ends in section 2
      cy.createSelection({
        startSection: { title: 'Middle Section To Convert' },
        startParagraph: {
          text: 'This is content in the middle section that will be converted to normal text'
        },
        startPosition: 'start',
        endSection: { title: 'Third Section level 1' },
        endParagraph: {
          text: 'Content in third section begins here'
        },
        endPosition: 'end'
      })

      // Use Meta+Option+0 shortcut to convert headings to normal text
      cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

      // Wait for changes to apply
      cy.wait(500)

      // Verify the headings were converted to normal text
      cy.get('.heading .title').contains('Third Section level 1').should('not.exist')
      cy.get('.heading .title').contains('Middle Section Heading 2').should('not.exist')
      cy.get('.heading .title').contains('Very Deep Heading').should('not.exist')

      // Verify the converted headings are now paragraphs
      cy.get('p').contains('Third Section level 1').should('exist')
      cy.get('p').contains('Middle Section Heading 2').should('exist')
      cy.get('p').contains('Very Deep Heading').should('exist')

      // Verify headings that weren't in the selection remain
      cy.get('.heading[level="3"] .title').contains('Third Section Nested 2').should('exist')

      // Validate structure after conversion
      cy.validateDomStructure().then((result) => {
        expect(result.valid).to.be.true
        expect(result.errors).have.length(0)
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
        // Verify sections
        cy.get('.heading[level="1"]').should('have.length', 2)

        // Check first section
        cy.get('.heading[level="1"]')
          .contains('First Section')
          .closest('.heading[level="1"]')
          .within(() => {
            // Original structure remains
            cy.get('.heading[level="2"]').should('have.length', 2)
            cy.get('.heading[level="3"]').should('have.length', 1)
          })

        // Check second section
        cy.get('.heading[level="1"]')
          .contains('Middle Section To Convert')
          .closest('.heading[level="1"]')
          .within(() => {
            // Level 3 heading "Another Nested Heading" should be gone
            cy.get('.heading[level="3"]').contains('Another Nested Heading').should('not.exist')
            cy.get('p').contains('Another Nested Heading').should('exist')

            // Level 4 heading "Very Deep Heading" should be gone
            cy.get('.heading[level="4"]').should('not.exist')
            cy.get('p').contains('Very Deep Heading').should('exist')

            cy.get('.heading[level="2"]').should('have.length', 2)
            cy.get('.heading[level="3"]').should('have.length', 2)
          })
      })
    })
  }
)
