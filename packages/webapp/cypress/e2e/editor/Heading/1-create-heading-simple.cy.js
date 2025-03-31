import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'
import {
  heading,
  paragraph,
  listItem,
  orderedList,
  section,
  bulletList
} from '../../../fixtures/docMaker'
import { generateDocumentTests } from '../../../fixtures/docTestHelper'

// Basic nesting with sequential levels
const SequentialLevelsDocument = {
  documentName: '1.Basic nesting with sequential levels',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Level 3 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Level 4 Heading', [
            paragraph(TEST_CONTENT.short),
            heading(5, 'Level 5 Heading', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ])
    ])
  ]
}

// Multiple siblings at level 2
const MultipleSiblingsDocument = {
  documentName: '2.Multiple siblings at level 2',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Level 2 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Second Level 2 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Third Level 2 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Fourth Level 2 Heading', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

// Single jump in heading levels
const HeadingLevelJumpDocument = {
  documentName: '3.Single jump in heading levels',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Level 3 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(5, 'Level 5 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Two separate sections
const TwoSectionsDocument = {
  documentName: '4.Two separate sections',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Section Level 2', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'First Section Level 3', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Second Section Level 2', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Second Section Level 3', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Section with mixed level siblings
const MixedLevelSiblingsDocument = {
  documentName: '5.Section with mixed level siblings',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(3, 'First Level 3 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(3, 'Second Level 3 Heading', [paragraph(TEST_CONTENT.short)]),
      heading(3, 'Third Level 3 Heading', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

// Non-sequential heading with proper nesting
const NonSequentialHeadingDocument = {
  documentName: '6.Non-sequential heading with proper nesting',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(4, 'Level 4 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Level 8 Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Balanced tree structure
const BalancedTreeDocument = {
  documentName: '7.Balanced tree structure',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Level 3 Under First', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Second Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Level 3 Under Second', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Complex document with mixed structure
const ComplexDocumentStructure = {
  documentName: '8.Complex document with mixed structure',
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Level 2 Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(5, 'Jump to Level 5', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Level 7 Heading', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(5, 'Another Level 5', [
          paragraph(TEST_CONTENT.short),
          bulletList([listItem('Bullet one', 0), listItem('Bullet two', 1)])
        ])
      ]),
      heading(2, 'Second Level 2 Heading', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Level 4 Heading', [
            paragraph(TEST_CONTENT.short),
            orderedList([listItem('First item', 0), listItem('Second item', 1)])
          ])
        ])
      ]),
      heading(2, 'Third Level 2 Heading', [paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      heading(4, 'Jump to Level 4', [
        paragraph(TEST_CONTENT.short),
        heading(8, 'Jump to Level 8', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(4, 'Another Level 4', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

// Generate tests for all document structures
generateDocumentTests(SequentialLevelsDocument, { screenshot: true })
generateDocumentTests(MultipleSiblingsDocument, { screenshot: true })
generateDocumentTests(HeadingLevelJumpDocument, { screenshot: true })
generateDocumentTests(TwoSectionsDocument, { screenshot: true })
generateDocumentTests(MixedLevelSiblingsDocument, { screenshot: true })
generateDocumentTests(NonSequentialHeadingDocument, { screenshot: true })
generateDocumentTests(BalancedTreeDocument, { screenshot: true })
generateDocumentTests(ComplexDocumentStructure, { screenshot: true })
