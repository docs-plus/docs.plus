import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'
import { paragraph, section } from '../../../fixtures/docMaker'

const SimpleDocumentStructure = {
  documentName: 'Wikipedia Paste Test',
  sections: [section('Wikipedia Paste Test', [paragraph(TEST_CONTENT.empty)])]
}

const NewsArticleDocumentStructure = {
  documentName: 'News Article Test',
  sections: [section('News Article Test', [paragraph(TEST_CONTENT.empty)])]
}

const DocumentationDocumentStructure = {
  documentName: 'Documentation Test',
  sections: [section('Documentation Test', [paragraph(TEST_CONTENT.empty)])]
}

const AdvancedFormattingDocumentStructure = {
  documentName: 'Advanced Formatting Test',
  sections: [section('Advanced Formatting Test', [paragraph(TEST_CONTENT.empty)])]
}

describe('External HTML to Editor Clipboard Tests', () => {
  beforeEach(() => {
    cy.viewport(1280, 900)
    // Visit an empty editor document before each test
    cy.visitEditor({ persist: true, docName: 'external_paste_test', clearDoc: true })
  })

  describe('Wikipedia Content', () => {
    it('Should handle Wikipedia article content', () => {
      // Create a section to paste into

      cy.createDocument(SimpleDocumentStructure)

      // Open Wikipedia fixture in iframe to access its content
      cy.visit('http://localhost:3000/external-html/wikipedia.html')

      // Capture original content for later comparison
      let originalContent = ''
      cy.get('#content-to-copy').then(($el) => {
        originalContent = $el.text().toWellFormed()
        console.log('originalContent', { originalContent })
      })

      cy.get('#content-to-copy').realClick({ force: true }).realPress(['Meta', 'a'])
      cy.get('body').realPress(['Meta', 'c'])

      // now visit the editor and paste the content
      cy.visitEditor({ persist: true, docName: 'external_paste_test' })
      cy.get('.docy_editor').click().realPress(['End']).realPress('Enter')
      cy.get('.docy_editor').realPress(['Meta', 'v'])

      // verify we just have one heading level 1
      cy.get('.docy_editor .heading[level="1"]').should('have.length', 1)

      // verify the heading level 1 has the title
      cy.get('.docy_editor .heading[level="1"] .title').should(
        'contain.text',
        'Wikipedia Paste Test'
      )

      // verify the heading 1 has heading 2
      cy.get('.docy_editor .heading[level="1"] .heading[level="2"]').should('have.length', 1)

      // veirfy we have at least 5 paragraphs
      cy.get('.docy_editor .heading[level="1"] .contents > p').should('have.length.at.least', 5)

      // verify we have at least 2 paragraphs in the heading 2
      cy.get('.docy_editor .heading[level="1"] .heading[level="2"] .contents > p').should(
        'have.length.at.least',
        2
      )

      // verify the p in heading 2 have at least 3 links
      cy.get('.docy_editor .heading[level="1"] .heading[level="2"] .contents > p a').should(
        'have.length.at.least',
        3
      )
      // check the each link is valid
      cy.get('.docy_editor .heading[level="1"] .heading[level="2"] .contents > p a').each(($el) => {
        expect($el).to.have.attr('href')
      })
    })
  })

  describe('News Article Content', () => {
    it('Should handle news article with images and formatting', () => {
      // Create a section to paste into
      cy.createDocument(NewsArticleDocumentStructure)

      // Open news article fixture in iframe to access its content
      cy.visit('http://localhost:3000/external-html/news-article.html')

      cy.get('#content-to-copy').realClick({ force: true }).realPress(['Meta', 'a'])
      cy.get('body').realPress(['Meta', 'c'])

      // now visit the editor and paste the content
      cy.visitEditor({ persist: true, docName: 'external_paste_test' })
      cy.get('.docy_editor').click().realPress(['End']).realType('--')
      cy.get('.docy_editor').realPress(['Meta', 'v'])

      // vrify the heading merge to gether correctly
      cy.get('.docy_editor .heading[level="1"] .title').should(
        'contain.text',
        'News Article Test—Tech Companies Announce New AI Initiatives'
      )
      // Verify the content is pasted correctly
      // verify the auther name and date
      cy.get('.docy_editor .heading[level="1"] .contents > p')
        .eq(0)
        .invoke('text')
        .then((text) => {
          // Use a very basic test - just check if the key parts are present
          const hasName = text.includes('Jane Smith')
          const hasDate = text.includes('May 15, 2023')
          expect(hasName).to.be.true
          expect(hasDate).to.be.true
        })

      // verify the second paragraph contains at least one img tag
      cy.get('.docy_editor .heading[level="1"] .contents > p')
        .eq(1)
        .find('img')
        .should('have.length.at.least', 1)

      // verify sencond paragphr content to be "Industry leaders gather at the 2023 AI Summit in San Francisco."
      cy.get('.docy_editor .heading[level="1"] .contents > p')
        .eq(2)
        .should('contain.text', 'Industry leaders gather at the 2023 AI Summit in San Francisco.')

      // verify the third paragraph contains at least one strong tag
      cy.get('.docy_editor .heading[level="1"] .contents > p').eq(3).find('strong').should('exist')

      // verify we have a blockquote element
      cy.get('.docy_editor .heading[level="1"] .contents > blockquote').should('exist')

      // verify in the heading 1 have a heading 2 with title "Market Response"
      cy.get('.docy_editor .heading[level="1"] .heading[level="2"] .title').should(
        'contain.text',
        'Market Response'
      )
    })
  })

  describe('Documentation Content', () => {
    it('Should handle MDN-like documentation with code blocks', () => {
      // Create a section to paste into
      cy.createDocument(DocumentationDocumentStructure)

      // Open news article fixture in iframe to access its content
      cy.visit('http://localhost:3000/external-html/documentation.html')

      cy.get('#content-to-copy').realClick({ force: true }).realPress(['Meta', 'a'])
      cy.get('body').realPress(['Meta', 'c'])

      // now visit the editor and paste the content
      cy.visitEditor({ persist: true, docName: 'external_paste_test' })
      cy.get('.docy_editor').click().realPress(['End']).realPress('Enter')

      cy.get('.docy_editor').realPress(['Meta', 'v'])

      // Verify structured content
      cy.get('.docy_editor .heading[level="1"] .contents').should('contain.text', 'map()')

      // Check headings
      cy.get('.docy_editor .heading[level="2"]').should('have.length', 2)
      cy.get('.docy_editor .heading[level="2"]')
        .first()
        .find('.title')
        .should('contain.text', 'Syntax')
      cy.get('.docy_editor .heading[level="2"]')
        .eq(1)
        .find('.title')
        .should('contain.text', 'Examples')

      // verify in the second heading 2 we have 2 heading with level 3
      cy.get('.docy_editor .heading[level="1"] .heading[level="2"]')
        .eq(1)
        .find('.heading[level="3"]')
        .should('have.length', 2)

      // Check code blocks
      cy.get('.docy_editor pre code, .docy_editor code').should('exist')
    })
  })

  describe('Complex Formatting', () => {
    it('Should handle advanced formatting from external HTML', () => {
      // Create a section to paste into
      cy.createDocument(AdvancedFormattingDocumentStructure)

      // Open complex formatting fixture in iframe to access its content
      cy.visit('http://localhost:3000/external-html/complex-formatting.html')

      cy.get('#content-to-copy').should('be.visible')
      // Select and copy the content
      cy.get('#content-to-copy').realClick({ force: true }).realPress(['Meta', 'a'])
      cy.get('body').realPress(['Meta', 'c'])

      // Visit the editor and paste the content
      cy.visitEditor({ persist: true, docName: 'external_paste_test' })
      cy.get('.docy_editor').click().realPress(['End']).realPress('Enter')
      cy.get('.docy_editor').realPress(['Meta', 'v'])

      // Verify the heading structure
      cy.get('.docy_editor .heading[level="1"] .title').should(
        'contain.text',
        'Advanced Formatting Test'
      )

      // Verify h2 heading exists
      cy.get('.docy_editor .heading[level="2"]').should('exist')
      cy.get('.docy_editor .heading[level="2"] .title').should(
        'contain.text',
        'Advanced Document Structure'
      )

      // Verify h3 headings
      cy.get('.docy_editor .heading[level="3"]').should('have.length.at.least', 2)

      // Verify h4 headings
      cy.get('.docy_editor .heading[level="4"]').should('have.length.at.least', 2)

      // Verify complex table structure
      cy.get('.docy_editor table').should('exist')
      cy.get('.docy_editor table th').should('have.length', 4)
      cy.get('.docy_editor table td').should('have.length.at.least', 12)

      // Verify table content
      cy.get('.docy_editor table').should('contain.text', 'Feature')
      cy.get('.docy_editor table').should('contain.text', 'Priority')
      cy.get('.docy_editor table').should('contain.text', 'Implemented')

      // Verify nested unordered lists
      cy.get('.docy_editor ul').should('exist')
      cy.get('.docy_editor ul li').should('have.length.at.least', 8)
      cy.get('.docy_editor ul ul').should('exist')

      // Verify nested ordered lists
      cy.get('.docy_editor ol').should('exist')
      cy.get('.docy_editor ol li').should('have.length.at.least', 8)
      cy.get('.docy_editor ol ol').should('exist')
      cy.get('.docy_editor ol ol ol').should('exist')

      // Verify text formatting
      cy.get('.docy_editor strong').should('exist')
      cy.get('.docy_editor em').should('exist')
      cy.get('.docy_editor u').should('exist')

      // Verify blockquote
      cy.get('.docy_editor blockquote').should('exist')
      cy.get('.docy_editor blockquote').should('contain.text', 'nested blockquote')

      // Verify code block
      cy.get('.docy_editor pre').should('exist')
      cy.get('.docy_editor pre').should('contain.text', 'function example')

      // Verify links
      cy.get('.docy_editor a').should('have.length.at.least', 2)
      cy.get('.docy_editor a').should('have.attr', 'href')
    })
  })
})
