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

// Use the same DocumentStructure from your existing test
const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.short),
      paragraph(TEST_CONTENT.short),
      orderedList([listItem('Initial point', 0), listItem('Supporting detail', 0)]),
      heading(2, TEST_TITLE.short, [
        paragraph(TEST_CONTENT.medium),
        paragraph(TEST_CONTENT.short),
        heading(3, TEST_TITLE.short, [
          paragraph(TEST_CONTENT.short),
          heading(4, TEST_TITLE.short, [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, TEST_TITLE.short, [paragraph(TEST_CONTENT.medium)]),
      heading(2, TEST_TITLE.short, [paragraph(TEST_CONTENT.medium), paragraph(TEST_CONTENT.short)])
    ]),
    section(TEST_TITLE.medium, [
      paragraph(TEST_CONTENT.medium),
      paragraph(TEST_CONTENT.short),
      heading(3, TEST_TITLE.short, [
        paragraph(TEST_CONTENT.short),
        heading(4, TEST_TITLE.short, [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section(TEST_TITLE.short, [
      paragraph(TEST_CONTENT.medium),
      paragraph(TEST_CONTENT.short),
      heading(8, TEST_TITLE.short, [
        paragraph(TEST_CONTENT.short),
        bulletList([
          listItem('Initial point', 0),
          listItem('Supporting detail 1', 1),
          listItem('Supporting detail 2', 1),
          listItem('Supporting detail 3', 0)
        ]),
        paragraph(TEST_CONTENT.short)
      ])
    ])
  ]
}

// Generate tests for this document structure
generateDocumentTests(DocumentStructure)
