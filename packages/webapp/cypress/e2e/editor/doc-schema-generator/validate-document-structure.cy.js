import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'
import {
  heading,
  paragraph,
  listItem,
  orderedList,
  section,
  bulletList
} from '../../../fixtures/docMaker'

const validDoc1 = {
  documentName: 'Valid Document Structure Example',
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Valid H2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Valid H3 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Valid H4 Heading', [
            paragraph(TEST_CONTENT.short),
            heading(6, 'Valid H6 Heading', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(3, 'Valid H3 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Valid H5 Heading', [paragraph(TEST_CONTENT.short)]),
          heading(5, 'Valid H5 Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

const validDoc2 = {
  documentName: 'Valid Document Structure Example',
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Valid H2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Valid H3 Heading', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Valid H3 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Valid H5 Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section('Second Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Valid H3 Heading', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Valid H5 Heading', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Valid H2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Valid H3 Heading', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Valid H3 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Valid H5 Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

const invalidDoc1 = {
  documentName: 'Invalid Document Structure Example',
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Invalid H3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(2, 'Invalid H2 Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

const invalidDoc2 = {
  documentName: 'Invalid Document Structure Example',
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Valid H2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'Valid H4 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(3, 'Invalid H3 Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section('Second Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Valid H3 Heading', [paragraph(TEST_CONTENT.short)]),
      section('Third Section', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Valid H5 Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

describe('Document structure validation examples', () => {
  // Test with validDoc1 structure
  it('Validates document structure with proper nesting (validDoc1)', () => {
    cy.validateDocumentStructure(validDoc1).then((result) => {
      expect(result.valid).to.be.true
      cy.log('✅ Valid Document: Structure validates correctly')
    })
  })

  // Test with validDoc2 structure
  it('Validates document structure with mixed heading levels (validDoc2)', () => {
    cy.validateDocumentStructure(validDoc2).then((result) => {
      expect(result.valid).to.be.true
      cy.log('✅ Valid Document: Structure validates correctly')
    })
  })

  // Test with invalidDoc1 structure - has H2 under H3 (invalid hierarchy)
  it('Identifies invalid heading hierarchy (invalidDoc1)', () => {
    cy.validateDocumentStructure(invalidDoc1).then((result) => {
      expect(result.valid).to.be.false
      cy.log('❌ Invalid Document: Properly detected child heading with level less than parent')
    })
  })

  // Test with invalidDoc2 structure - has nested section and H3 under H4
  it('Identifies nested sections and invalid hierarchy (invalidDoc2)', () => {
    cy.validateDocumentStructure(invalidDoc2).then((result) => {
      expect(result.valid).to.be.false
      cy.log('❌ Invalid Document: Properly detected nested sections or invalid heading hierarchy')
    })
  })

  // Testing specific cases of heading hierarchy
  it('Validates proper heading hierarchy relationships', () => {
    // Valid: Sequential hierarchy
    const validSequential = {
      documentName: 'Valid Sequential Hierarchy',
      sections: [
        section('Test Section', [
          paragraph('Test paragraph'),
          heading(2, 'H2 Heading', [
            paragraph('Test paragraph'),
            heading(3, 'H3 Heading', [
              paragraph('Test paragraph'),
              heading(4, 'H4 Heading', [paragraph('Test paragraph')])
            ])
          ])
        ])
      ]
    }

    // Valid: Non-sequential but still proper hierarchy
    const validNonSequential = {
      documentName: 'Valid Non-Sequential Hierarchy',
      sections: [
        section('Test Section', [
          paragraph('Test paragraph'),
          heading(2, 'H2 Heading', [
            paragraph('Test paragraph'),
            heading(5, 'H5 Heading', [paragraph('Test paragraph')])
          ])
        ])
      ]
    }

    // Invalid: Child heading with level <= parent
    const invalidHierarchy = {
      documentName: 'Invalid Hierarchy',
      sections: [
        section('Test Section', [
          paragraph('Test paragraph'),
          heading(4, 'H4 Heading', [
            paragraph('Test paragraph'),
            heading(3, 'H3 Heading', [paragraph('Test paragraph')])
          ])
        ])
      ]
    }

    // Invalid: Nested sections
    const invalidNestedSections = {
      documentName: 'Invalid Nested Sections',
      sections: [
        section('Test Section', [
          paragraph('Test paragraph'),
          section('Nested Section', [paragraph('Test paragraph')])
        ])
      ]
    }

    cy.validateDocumentStructure(validSequential).then((result) => {
      expect(result.valid).to.be.true
      cy.log('✅ Valid sequential hierarchy validated correctly')
    })

    cy.validateDocumentStructure(validNonSequential).then((result) => {
      expect(result.valid).to.be.true
      cy.log('✅ Valid non-sequential hierarchy validated correctly')
    })

    cy.validateDocumentStructure(invalidHierarchy).then((result) => {
      expect(result.valid).to.be.false
      cy.log('❌ Invalid heading hierarchy rejected correctly')
    })

    cy.validateDocumentStructure(invalidNestedSections).then((result) => {
      expect(result.valid).to.be.false
      cy.log('❌ Invalid nested sections rejected correctly')
    })
  })
})
