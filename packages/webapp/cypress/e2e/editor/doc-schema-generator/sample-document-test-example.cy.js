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

// Sample document structure to test with corrected heading hierarchy
const SampleDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      paragraph(TEST_CONTENT.medium),
      orderedList([
        listItem('First item', 0),
        listItem('Second item', 1),
        listItem('Third item', 0)
      ]),
      heading(2, 'Section 1 Heading', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Nested Heading', [
          paragraph(TEST_CONTENT.short),
          bulletList([
            listItem('Bullet one', 0),
            listItem('Bullet two', 1),
            listItem('Bullet three', 0),
            listItem('Bullet four', 1),
            listItem('Bullet five', 2),
            listItem('Bullet six', 0)
          ])
        ])
      ])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.long),
      heading(2, 'Another Heading', [
        paragraph(TEST_CONTENT.medium),
        heading(3, 'Special Heading', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Nested Special Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Special Level 2 Heading', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Another Level 3 Heading', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Another Level 4 Heading', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

// Generate tests for the sample document structure
// This will automatically validate the structure and create tests
generateDocumentTests(SampleDocumentStructure)
