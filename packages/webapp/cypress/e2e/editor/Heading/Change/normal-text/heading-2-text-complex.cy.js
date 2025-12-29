/* eslint-disable no-undef */
import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import { section, paragraph, heading } from '../../../../../fixtures/docMaker'

// Very complex nested document structure
const complexDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Non-Sequential Heading', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Deep Nested Target', [paragraph(TEST_CONTENT.short)]),
          heading(7, 'Another Deep Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Main Content', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'First Subsection', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Details', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Second Subsection', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Section', [
      paragraph(TEST_CONTENT.short),
      heading(6, 'High Level Jump', [
        paragraph(TEST_CONTENT.short),
        heading(9, 'Nearly Maximal Level', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(3, 'Middle Level Heading', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Third Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Conclusion', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

// Test cases for converting different headings to text
const testCases = [
  {
    description: 'Convert deeply nested heading to text',
    target: { level: 7, text: 'Deep Nested Target' },
    expectedDocumentAfter: {
      documentName: TEST_TITLE.HelloDocy,
      sections: [
        section('First Section', [
          paragraph(TEST_CONTENT.short),
          heading(2, 'Introduction', [
            paragraph(TEST_CONTENT.short),
            heading(4, 'Non-Sequential Heading', [
              paragraph(TEST_CONTENT.short),
              // Converted to paragraph
              paragraph('Deep Nested Target'),
              paragraph(TEST_CONTENT.short),
              heading(7, 'Another Deep Heading', [paragraph(TEST_CONTENT.short)])
            ])
          ]),
          heading(2, 'Main Content', [
            paragraph(TEST_CONTENT.short),
            heading(3, 'First Subsection', [
              paragraph(TEST_CONTENT.short),
              heading(5, 'Details', [paragraph(TEST_CONTENT.short)])
            ]),
            heading(3, 'Second Subsection', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        section('Second Section', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'High Level Jump', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Nearly Maximal Level', [paragraph(TEST_CONTENT.short)])
          ]),
          heading(3, 'Middle Level Heading', [paragraph(TEST_CONTENT.short)])
        ]),
        section('Third Section', [
          paragraph(TEST_CONTENT.short),
          heading(2, 'Conclusion', [paragraph(TEST_CONTENT.short)])
        ])
      ]
    }
  },
  {
    description: 'Convert mid-level heading to text',
    target: { level: 3, text: 'First Subsection' },
    expectedDocumentAfter: {
      documentName: TEST_TITLE.HelloDocy,
      sections: [
        section('First Section', [
          paragraph(TEST_CONTENT.short),
          heading(2, 'Introduction', [
            paragraph(TEST_CONTENT.short),
            heading(4, 'Non-Sequential Heading', [
              paragraph(TEST_CONTENT.short),
              paragraph('Deep Nested Target'),
              paragraph(TEST_CONTENT.short),
              heading(7, 'Another Deep Heading', [paragraph(TEST_CONTENT.short)])
            ])
          ]),
          heading(2, 'Main Content', [
            paragraph(TEST_CONTENT.short),
            // Converted to paragraph
            paragraph('First Subsection'),
            paragraph(TEST_CONTENT.short),
            // Details heading now becomes child of Main Content
            heading(5, 'Details', [paragraph(TEST_CONTENT.short)]),
            heading(3, 'Second Subsection', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        section('Second Section', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'High Level Jump', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Nearly Maximal Level', [paragraph(TEST_CONTENT.short)])
          ]),
          heading(3, 'Middle Level Heading', [paragraph(TEST_CONTENT.short)])
        ]),
        section('Third Section', [
          paragraph(TEST_CONTENT.short),
          heading(2, 'Conclusion', [paragraph(TEST_CONTENT.short)])
        ])
      ]
    }
  },
  {
    description: 'Convert section (heading level 1) to normal text',
    target: { level: 1, text: 'Second Section' },
    expectedDocumentAfter: {
      documentName: TEST_TITLE.HelloDocy,
      sections: [
        section('First Section', [
          paragraph(TEST_CONTENT.short),
          heading(2, 'Introduction', [
            paragraph(TEST_CONTENT.short),
            heading(4, 'Non-Sequential Heading', [
              paragraph(TEST_CONTENT.short),
              paragraph('Deep Nested Target'),
              paragraph(TEST_CONTENT.short),
              heading(7, 'Another Deep Heading', [paragraph(TEST_CONTENT.short)])
            ])
          ])
        ]),

        section('First Section', [
          paragraph(TEST_CONTENT.short),
          heading(2, 'Introduction', [
            paragraph(TEST_CONTENT.short),
            heading(4, 'Non-Sequential Heading', [
              paragraph(TEST_CONTENT.short),
              // Converted to paragraph
              paragraph('Deep Nested Target'),
              paragraph(TEST_CONTENT.short),
              heading(7, 'Another Deep Heading', [paragraph(TEST_CONTENT.short)])
            ])
          ]),
          heading(2, 'Main Content', [
            paragraph(TEST_CONTENT.short),
            heading(3, 'First Subsection', [
              paragraph(TEST_CONTENT.short),
              heading(5, 'Details', [paragraph(TEST_CONTENT.short)])
            ]),
            heading(3, 'Second Subsection', [
              paragraph(TEST_CONTENT.short),
              paragraph('Third Section'),
              paragraph(TEST_CONTENT.short),
              heading(6, 'High Level Jump', [
                paragraph(TEST_CONTENT.short),
                heading(9, 'Nearly Maximal Level', [paragraph(TEST_CONTENT.short)])
              ])
            ]),
            heading(3, 'Middle Level Heading', [paragraph(TEST_CONTENT.short)])
          ])
        ]),

        section('Third Section', [
          paragraph(TEST_CONTENT.short),
          heading(2, 'Conclusion', [paragraph(TEST_CONTENT.short)])
        ])
      ]
    }
  }
]

/**
 * Converts a heading to normal text
 * @param {Object} target - The heading to convert {level, text}
 */
function convertHeadingToText(target) {
  // Position cursor in target heading
  cy.putPosCaretInHeading(target.level, target.text, 'start')

  // Use keyboard shortcut to convert to normal text
  cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

  // Wait for changes to apply
  cy.wait(500)
}

/**
 * Verifies heading was properly converted to text
 * @param {string} headingText - The text of the converted heading
 * @param {Object} expectedStructure - Expected document structure after conversion
 */
function verifyHeadingConversion(headingText, expectedStructure) {
  // Verify heading no longer exists as heading
  cy.get('.heading .title').contains(headingText).should('not.exist')

  // Verify text exists as paragraph now
  cy.get('p').contains(headingText).should('exist')

  // Verify document structure remains valid
  cy.validateDocumentStructure(expectedStructure).then((result) => {
    console.log('result', result)
    expect(result.valid).to.be.true
    expect(result.errors).to.be.undefined
  })
}

describe('Convert Headings to Text - Complex Cases', () => {
  beforeEach(() => {
    // Start fresh for each test to avoid state issues
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'heading-to-text-complex-doc' })
    cy.createDocument(complexDocumentStructure)
    cy.wait(500)

    // Verify initial document structure is valid
    cy.validateDocumentStructure(complexDocumentStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  // Generate tests from test cases
  testCases.forEach((testCase) => {
    it(`should ${testCase.description}`, () => {
      const { target, expectedDocumentAfter } = testCase

      // Convert heading to text
      convertHeadingToText(target)

      // Verify conversion worked correctly
      verifyHeadingConversion(target.text, expectedDocumentAfter)

      // should verify dome structure
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
        expect(result.errors).have.length(0)
      })
    })
  })
})
