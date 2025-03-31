import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'
import { heading, paragraph, section } from '../../../fixtures/docMaker'
import { generateDocumentTests } from '../../../fixtures/docTestHelper'

// Deep nesting with varied level jumps
const DeepNestingDocument = {
  documentName: '1.Deep nesting with varied level jumps',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(5, 'Level 5 Under First', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 5', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Level 3 Under Second', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 3', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Another Level 3', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 3', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(4, 'Level 4 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(8, 'Level 8 Under 4', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Multiple branching with mixed siblings
const MultipleBranchingDocument = {
  documentName: '2.Multiple branching with mixed siblings',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'First Level 3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(5, 'First Level 5 Under 3', [paragraph(TEST_CONTENT.short)]),
        heading(5, 'Second Level 5 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(3, 'Second Level 3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'Level 4 Under Second 3', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 4', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(4, 'Another Level 4', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'First Level 2 in Second Section', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Second Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Level 6 Under 2', [paragraph(TEST_CONTENT.short)]),
        heading(6, 'Another Level 6', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 6', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Cross-section complexity with diverse depths
const CrossSectionComplexityDocument = {
  documentName: '3.Cross-section complexity with diverse depths',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(4, 'First Level 4 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(6, 'Level 6 Under 4', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 6', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(4, 'Second Level 4 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(5, 'Level 5 Under Second 4', [paragraph(TEST_CONTENT.short)]),
        heading(5, 'Another Level 5', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 5', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'First Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Under 2', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Another Level 3', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Second Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(8, 'Level 8 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Maximum hierarchy with balanced distribution
const MaxHierarchyDocument = {
  documentName: '4.Maximum hierarchy with balanced distribution',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'First Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 4', [paragraph(TEST_CONTENT.short)]),
          heading(6, 'Another Level 6', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(4, 'Second Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 4', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Level 3 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 3', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(3, 'Level 3 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Level 6 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 6', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Multi-section interleaved structure
const MultiSectionDocument = {
  documentName: '5.Multi-section interleaved structure',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'First Level 3 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(3, 'Second Level 3 Heading', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(3, 'Third Level 3 Heading', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'First Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Level 4 Under 2', [paragraph(TEST_CONTENT.short)]),
        heading(4, 'Another Level 4', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Second Level 2 in Second Section', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.long, [
      paragraph(TEST_CONTENT.short),
      heading(7, 'Level 7 in Third Section', [
        paragraph(TEST_CONTENT.short),
        heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Complex sibling relationships across multiple depths
const ComplexSiblingDocument = {
  documentName: '6.Complex sibling relationships across multiple depths',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(5, 'First Level 5 Under 2', [paragraph(TEST_CONTENT.short)]),
        heading(5, 'Second Level 5 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 5', [paragraph(TEST_CONTENT.short)]),
          heading(7, 'Another Level 7', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Level 3 Under Second 2', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'First Level 4 Under 3', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Second Level 4 Under 3', [
            paragraph(TEST_CONTENT.short),
            heading(6, 'Level 6 Under 4', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(3, 'Another Level 3', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(8, 'Level 8 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(9, 'Level 9 Under 8', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Asymmetric tree structure with varied level distributions
const AsymmetricTreeDocument = {
  documentName: '7.Asymmetric tree structure with varied level distributions',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(4, 'First Level 4 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(5, 'Level 5 Under First 4', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(5, 'Another Level 5', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 5', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(4, 'Second Level 4 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(4, 'Third Level 4 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(6, 'Level 6 Under Third 4', [paragraph(TEST_CONTENT.short)]),
        heading(6, 'Another Level 6', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'First Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 3', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(9, 'Level 9 Under 2', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Multi-branch structure with deep nesting
const MultiBranchDocument = {
  documentName: '8.Multi-branch structure with deep nesting',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'First Level 3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'First Level 4 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 4', [paragraph(TEST_CONTENT.short)]),
          heading(6, 'Another Level 6', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(4, 'Second Level 4 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Level 5 Under 4', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 5', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ]),
      heading(3, 'Second Level 3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(7, 'Level 7 Under Second 3', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(7, 'Another Level 7', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(9, 'Level 9 Under 2', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Mixed depth pattern with alternating siblings
const MixedDepthDocument = {
  documentName: '9.Mixed depth pattern with alternating siblings',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Level 2 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Second Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'Level 4 Under 2', [paragraph(TEST_CONTENT.short)]),
        heading(4, 'Another Level 4', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Level 6 Under 4', [paragraph(TEST_CONTENT.short)]),
          heading(6, 'Another Level 6', [
            paragraph(TEST_CONTENT.short),
            heading(8, 'Level 8 Under 6', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(4, 'Third Level 4', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Third Level 2 Heading', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(3, 'Level 3 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Under 5', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ]),
      heading(3, 'Another Level 3', [
        paragraph(TEST_CONTENT.short),
        heading(9, 'Level 9 Under 3', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Extreme level jumps with comprehensive coverage
const ExtremeLevelJumpsDocument = {
  documentName: '10.Extreme level jumps with comprehensive coverage',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'First Level 3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(6, 'Level 6 Under 3', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 6', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(6, 'Another Level 6', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(3, 'Second Level 3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(7, 'Level 7 Under Second 3', [
          paragraph(TEST_CONTENT.short),
          heading(9, 'Level 9 Under 7', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(2, 'First Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Level 4 Under 2', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Level 8 Under 4', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Second Level 2 in Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Level 5 Under 2', [paragraph(TEST_CONTENT.short)]),
        heading(5, 'Another Level 5', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.long, [
      paragraph(TEST_CONTENT.short),
      heading(4, 'Level 4 in Third Section', [
        paragraph(TEST_CONTENT.short),
        heading(9, 'Level 9 Under 4', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Generate tests for all complex document structures
generateDocumentTests(DeepNestingDocument, { screenshot: true })
generateDocumentTests(MultipleBranchingDocument, { screenshot: true })
generateDocumentTests(CrossSectionComplexityDocument, { screenshot: true })
generateDocumentTests(MaxHierarchyDocument, { screenshot: true })
generateDocumentTests(MultiSectionDocument, { screenshot: true })
generateDocumentTests(ComplexSiblingDocument, { screenshot: true })
generateDocumentTests(AsymmetricTreeDocument, { screenshot: true })
generateDocumentTests(MultiBranchDocument, { screenshot: true })
generateDocumentTests(MixedDepthDocument, { screenshot: true })
generateDocumentTests(ExtremeLevelJumpsDocument, { screenshot: true })
