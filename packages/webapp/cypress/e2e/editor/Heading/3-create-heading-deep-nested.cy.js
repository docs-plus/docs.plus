import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'
import { heading, paragraph, section } from '../../../fixtures/docMaker'
import { generateDocumentTests } from '../../../fixtures/docTestHelper'

// Five-section structure with extreme depth variation
const ExtremeDepthVariationDocument = {
  documentName: '1.Extreme depth variation',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Section Level 2 A', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 6', [
              paragraph(TEST_CONTENT.short),
              heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
            ])
          ])
        ]),
        heading(4, 'Another Level 4', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(7, 'Level 7 Under 5', [
              paragraph(TEST_CONTENT.short),
              heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
            ])
          ])
        ])
      ]),
      heading(2, 'First Section Level 2 B', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Under 2B', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(3, 'Second Section Level 3 A', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'First Level 7 Under 5', [paragraph(TEST_CONTENT.short)]),
          heading(7, 'Second Level 7 Under 5', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(5, 'Another Level 5', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(3, 'Second Section Level 3 B', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.long, [
      paragraph(TEST_CONTENT.short),
      heading(4, 'Third Section Level 4', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Level 6 Under 4', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Level 8 Under 6', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section('Fourth Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Fourth Section Level 2 A', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 3', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ]),
      heading(2, 'Fourth Section Level 2 B', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Fifth Section', [
      paragraph(TEST_CONTENT.short),
      heading(5, 'Fifth Section Level 5', [
        paragraph(TEST_CONTENT.short),
        heading(7, 'Level 7 Under 5', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Multi-section structure with maximum depth reach
const MaximumDepthReachDocument = {
  documentName: '2.Maximum depth reach',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'First Section Level 3', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'Level 4 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(6, 'Level 6 Under 5', [
              paragraph(TEST_CONTENT.short),
              heading(7, 'Level 7 Under 6', [
                paragraph(TEST_CONTENT.short),
                heading(8, 'Level 8 Under 7', [
                  paragraph(TEST_CONTENT.short),
                  heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
                ]),
                heading(8, 'Another Level 8', [paragraph(TEST_CONTENT.short)])
              ]),
              heading(7, 'Another Level 7', [paragraph(TEST_CONTENT.short)])
            ]),
            heading(6, 'Another Level 6', [paragraph(TEST_CONTENT.short)])
          ]),
          heading(5, 'Another Level 5', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(3, 'Another Level 3', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'Second Section Level 2 A', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 4', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Section Level 2 B', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 3', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ])
    ]),
    section(TEST_TITLE.long, [
      paragraph(TEST_CONTENT.short),
      heading(4, 'Third Section Level 4 A', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'First Level 6 Under 4', [paragraph(TEST_CONTENT.short)]),
        heading(6, 'Second Level 6 Under 4', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 6', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(4, 'Third Section Level 4 B', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Fourth Section', [
      paragraph(TEST_CONTENT.short),
      heading(5, 'Fourth Section Level 5', [
        paragraph(TEST_CONTENT.short),
        heading(7, 'Level 7 Under 5', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Fifth Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Fifth Section Level 2', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ])
    ])
  ]
}

// Complex interleaved sections with asymmetric depth distribution
const AsymmetricDepthDistributionDocument = {
  documentName: '3.Asymmetric depth distribution',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Section Level 2 A', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'First Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(4, 'Second Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ]),
      heading(2, 'First Section Level 2 B', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(3, 'Second Section Level 3 A', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'First Level 6 Under 5', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 6', [
              paragraph(TEST_CONTENT.short),
              heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
            ])
          ]),
          heading(6, 'Second Level 6 Under 5', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(5, 'Another Level 5', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(3, 'Second Section Level 3 B', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.long, [
      paragraph(TEST_CONTENT.short),
      heading(4, 'Third Section First Level 4', [paragraph(TEST_CONTENT.short)]),
      heading(4, 'Third Section Second Level 4', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Level 6 Under 4', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 6', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ]),
      heading(4, 'Third Section Third Level 4', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Fourth Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Fourth Section First Level 2', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 3', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Fourth Section Second Level 2', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 2', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Fifth Section', [
      paragraph(TEST_CONTENT.short),
      heading(6, 'Fifth Section Level 6', [
        paragraph(TEST_CONTENT.short),
        heading(8, 'Level 8 Under 6', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Sixth Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Sixth Section Level 3', [
        paragraph(TEST_CONTENT.short),
        heading(7, 'Level 7 Under 3', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Extreme branching with mixed depths across six sections
const ExtremeBranchingDocument = {
  documentName: '4.Extreme branching with mixed depths',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'First Section Level 3 A', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'First Level 4 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'First Level 7 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 7', [
              paragraph(TEST_CONTENT.short),
              heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
            ])
          ]),
          heading(7, 'Second Level 7 Under 4', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(4, 'Second Level 4 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Level 9 Under 5', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ]),
      heading(3, 'First Section Level 3 B', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'First Level 6 Under 3', [paragraph(TEST_CONTENT.short)]),
        heading(6, 'Second Level 6 Under 3', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'Second Section Level 2 A', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 3', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(3, 'Another Level 3', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Second Section Level 2 B', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.long, [
      paragraph(TEST_CONTENT.short),
      heading(4, 'Third Section Level 4 A', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 4', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 5', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(4, 'Third Section Level 4 B', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Level 6 Under 4', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Fourth Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Fourth Section Level 2', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Level 9 Under 6', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ])
    ]),
    section('Fifth Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Fifth Section Level 3 A', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Level 6 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 6', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(3, 'Fifth Section Level 3 B', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section('Sixth Section', [
      paragraph(TEST_CONTENT.short),
      heading(5, 'Sixth Section Level 5', [
        paragraph(TEST_CONTENT.short),
        heading(8, 'Level 8 Under 5', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Generate tests for all deep nested document structures
generateDocumentTests(ExtremeDepthVariationDocument, { screenshot: true })
generateDocumentTests(MaximumDepthReachDocument, { screenshot: true })
generateDocumentTests(AsymmetricDepthDistributionDocument, { screenshot: true })
generateDocumentTests(ExtremeBranchingDocument, { screenshot: true })
