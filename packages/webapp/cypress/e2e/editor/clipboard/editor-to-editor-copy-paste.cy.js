import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'
import {
  heading,
  paragraph,
  listItem,
  orderedList,
  section,
  bulletList
} from '../../../fixtures/docMaker'

// Test document structures
const SimpleDocumentStructure = {
  documentName: 'Simple Source Document',
  sections: [
    section('first Section', [
      paragraph(TEST_CONTENT.short),
      paragraph(TEST_CONTENT.medium),
      paragraph(TEST_CONTENT.empty),
      paragraph(TEST_CONTENT.short)
    ]),
    section('Second Section', [
      paragraph(TEST_CONTENT.long),
      paragraph(TEST_CONTENT.empty),
      paragraph(TEST_CONTENT.short)
    ])
  ]
}

const ComplexDocumentStructure = {
  documentName: 'Complex Source Document',
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      bulletList([
        listItem('Bullet point 1', 0),
        listItem('Bullet point 2', 0),
        listItem('Nested bullet 1', 1),
        listItem('Nested bullet 2', 1)
      ]),
      heading(2, 'Level 2 Heading', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Heading', [
          paragraph(TEST_CONTENT.short),
          orderedList([listItem('Ordered item 1', 0), listItem('Ordered item 2', 0)])
        ])
      ])
    ]),
    section('Second Section', [
      paragraph(TEST_CONTENT.medium),
      heading(4, 'Deeply Nested Heading', [
        paragraph(TEST_CONTENT.short),
        bulletList([
          listItem('Another bullet', 0),
          listItem('With nesting', 1),
          listItem('And more nesting', 2)
        ])
      ])
    ])
  ]
}

const MixedFormattingDocumentStructure = {
  documentName: 'Mixed Formatting Document',
  sections: [section('Formatting Section', [paragraph(TEST_CONTENT.short)])]
}

// Access to the clipboard reliably works in Electron browser
// in other browsers, there are popups asking for permission
describe(
  'Editor-to-Editor Clipboard Tests',
  {
    electron: true
  },
  () => {
    beforeEach(() => {
      cy.viewport(1280, 900)
    })

    describe('Basic Copy-Paste Tests', () => {
      it('Should copy and paste simple content between documents', () => {
        // Create source document
        cy.visitEditor()
        cy.createDocument(SimpleDocumentStructure)

        // Select all content and copy
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'a'])
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'c'])

        // Visit target document
        cy.visitEditor()

        // Paste content
        cy.get('.docy_editor .ProseMirror').click()
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'v'])

        // Verify content was pasted correctly
        cy.get('.docy_editor .heading[level="1"]:nth-child(1) .title').should(
          'contain.text',
          'first Section'
        )

        // cy.get('.docy_editor').should('contain.text', 'Second Section')
        cy.get('.docy_editor .heading[level="1"]:nth-child(1)  .contents  p ')
          .eq(0)
          .should('contain.text', TEST_CONTENT.short)
        cy.get('.docy_editor .heading[level="1"]:nth-child(1)  .contents  p ')
          .eq(1)
          .should('contain.text', TEST_CONTENT.medium)
        cy.get('.docy_editor .heading[level="1"]:nth-child(1)  .contents  p ')
          .eq(2)
          .should('contain.text', '')
        cy.get('.docy_editor .heading[level="1"]:nth-child(1)  .contents  p ')
          .eq(3)
          .should('contain.text', TEST_CONTENT.short)
      })
    })

    describe('Complex Structure Copy-Paste Tests', () => {
      it('Should copy and paste a complex document structure between documents', () => {
        // Create source document with complex structure
        cy.visitEditor()
        cy.createDocument(ComplexDocumentStructure)

        // Select entire document and copy
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'a'])
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'c'])

        // Visit target document
        cy.visitEditor()

        // Paste content
        cy.get('.docy_editor .ProseMirror').click()
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'v'])

        // Verify content was pasted correctly
        // Verify sections
        cy.get('.docy_editor .heading[level="1"]').should('have.length.above', 2)

        // Verify first section
        cy.get('.docy_editor .heading[level="1"]')
          .eq(0)
          .find('.title')
          .should('contain.text', 'First Section')

        // Verify bullet list
        cy.get('.docy_editor .heading[level="1"]')
          .eq(0)
          .find('ul')
          .eq(0)
          .find(' li')
          .should('have.length', 4)

        // Verify nested headings
        cy.get('.docy_editor .heading[level="2"]').should('have.length', 1)
        cy.get('.docy_editor .heading[level="3"]').should('have.length', 1)
        cy.get('.docy_editor .heading[level="4"]').should('have.length', 1)

        // Verify second section
        cy.get('.docy_editor .heading[level="1"]')
          .eq(1)
          .find('.title')
          .should('contain.text', 'Second Section')
      })
    })

    describe('Partial Content Copy-Paste Tests', () => {
      it('Should copy and paste a single paragraph', () => {
        // Create source document
        cy.visitEditor()
        cy.createDocument(SimpleDocumentStructure)

        // Select and copy only the first paragraph
        cy.get('.docy_editor .heading[level="1"] .contents > p').eq(0).click()
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'a']) // This selects only the paragraph since click focused it
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'c'])

        // Visit target document
        cy.visitEditor()

        // Create an empty section, the first section is already created!
        cy.get('.docy_editor .ProseMirror').click()
        cy.get('.docy_editor .ProseMirror').realType('Target Section')

        // Paste content, this must merge the content from clipboard with the typed text as heading
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'v'])

        // verfiy the title of the section
        cy.get('.docy_editor .heading[level="1"] .title').should(
          'contain.text',
          'Target Sectionfirst Section'
        )

        // Verify content was pasted correctly
        cy.get('.docy_editor .heading[level="1"] .contents > p')
          .eq(0)
          .should('contain.text', TEST_CONTENT.short)
      })

      it('Should copy and paste a heading with its content', () => {
        // Create source document with complex structure
        cy.visitEditor()
        // cy.createDocument(ComplexDocumentStructure)
        cy.createDocument(ComplexDocumentStructure)

        // Select and copy the level 2 heading and its content
        cy.get('.docy_editor .heading[level="2"] .title').first().clickAndSelectCopy('heading')

        // Visit target document
        cy.visitEditor()

        // Create an empty section
        cy.get('.docy_editor .ProseMirror').click()
        cy.get('.docy_editor .ProseMirror').realType('Target Section').realPress('Enter')

        // Paste content
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'v'])

        // Verify content was pasted correctly
        cy.get('.docy_editor .heading[level="2"]').should('have.length', 1)
        cy.get('.docy_editor .heading[level="2"] .title').should('contain.text', 'Level 2 Heading')
        cy.get('.docy_editor .heading[level="3"]').should('have.length', 1)
      })
    })

    describe('Edge Cases and Schema Validation', () => {
      it('Should maintain proper schema when pasting content with invalid structure', () => {
        // Create source document with complex structure
        cy.visitEditor()
        cy.createDocument(ComplexDocumentStructure)

        // Select all content
        cy.get('.docy_editor .ProseMirror').clickAndSelectCopy('document')

        // Visit target document that already has content
        cy.visitEditor()

        // Create a simple document
        cy.createDocument(SimpleDocumentStructure)

        // Place cursor in the middle of existing content
        cy.get('.docy_editor .heading[level="1"] .contents > p').eq(0).click()
        cy.get('.docy_editor .ProseMirror').realPress(['End'])

        // Paste complex content in the middle of existing content
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'v'])

        // Verify that the document structure is valid (doesn't have nested sections)
        cy.get('.docy_editor .heading[level="1"] .heading[level="1"]').should('not.exist')
        cy.get('.docy_editor .heading[level="1"]').should('have.length.at.least', 3)
        cy.get('.docy_editor .heading[level="2"]').should('have.length', 1)
        cy.get('.docy_editor .heading[level="3"]').should('have.length', 1)
        cy.get('.docy_editor .heading[level="4"]').should('have.length', 1)

        // Also verify that the first section contents are exist and merge to last section in heading level 4
        cy.get('.docy_editor .heading[level="4"] .contents > p')
          .eq(-2)
          .should('contain.text', TEST_CONTENT.short)

        cy.get('.docy_editor .heading[level="4"] .contents > p').eq(-3).should('contain.text', '')

        cy.get('.docy_editor .heading[level="4"] .contents > p')
          .eq(-4)
          .should('contain.text', TEST_CONTENT.medium)
      })

      it('Should copy mixed formatting between documents', () => {
        // Create source document
        cy.visitEditor()
        cy.createDocument(MixedFormattingDocumentStructure)

        // Add formatted text
        cy.get('.docy_editor .heading[level="1"] .contents > p')
          .first()
          .realClick()
          .realPress('Home')
        cy.get('.docy_editor .ProseMirror').realType('This is ')

        // Bold text
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'b'])
        cy.get('.docy_editor .ProseMirror').realType('bold')

        // Continue with italic
        cy.get('.docy_editor .ProseMirror').realType(' and ')
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'i'])
        cy.get('.docy_editor .ProseMirror').realType('italic')

        // Select all and copy
        cy.get('.docy_editor .ProseMirror').clickAndSelectCopy('document')

        // Visit target document
        cy.visitEditor()

        // Paste content
        cy.get('.docy_editor .ProseMirror').realClick()
        cy.get('.docy_editor .ProseMirror').realPress(['Meta', 'v'])

        // Verify formatting was preserved
        cy.get('.docy_editor strong').should('contain.text', 'bold')
        cy.get('.docy_editor em').should('contain.text', 'italic')
      })
    })
  }
)
