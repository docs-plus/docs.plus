/* eslint-disable no-undef */
import { TEST_CONTENT, TEST_TITLE } from '../../support/commands'
import {
  heading,
  paragraph,
  listItem,
  orderedList,
  section,
  bulletList
} from '../../fixtures/docMaker'

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

describe('document creation', { testIsolation: false }, () => {
  before(() => {
    cy.viewport(1280, 1900)
    cy.visitEditor({ persist: false, clearDoc: true })
  })

  it('Create a document from structure', () => {
    cy.createDocument(DocumentStructure)
  })

  it('Verify overall document structure', () => {
    // Verify we have 3 level-1 headings (sections)
    cy.get('.docy_editor .heading[level="1"]').should('have.length', 3)

    // Verify we have 3 level-2 headings
    cy.get('.docy_editor .heading[level="2"]').should('have.length', 3)

    // Verify we have 1 level-3 heading
    cy.get('.docy_editor .heading[level="3"]').should('have.length', 2)

    // Verify we have 1 level-4 heading
    cy.get('.docy_editor .heading[level="4"]').should('have.length', 2)

    // Verify we have 1 level-8 heading
    cy.get('.docy_editor .heading[level="8"]').should('have.length', 1)
  })

  describe('First section verification', () => {
    let firstSection

    beforeEach(() => {
      firstSection = cy.get('.docy_editor .heading[level="1"]').first()
    })

    it('Verifies section title and initial content', () => {
      // Verify title
      firstSection.find('.title').first().should('contain.text', TEST_TITLE.short)

      // Verify initial paragraphs (inside contentWrapper > contents)
      firstSection
        .find('> .contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.short)
      firstSection
        .find('> .contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies ordered list structure', () => {
      firstSection.find('ol').within(() => {
        cy.get('li').should('have.length', 2)
        cy.get('li').eq(0).should('contain.text', 'Initial point')
        cy.get('li').eq(1).should('contain.text', 'Supporting detail')
      })
    })

    it('Verifies level-2 headings structure', () => {
      // Get all level-2 headings in first section
      firstSection.find('.heading[level="2"]').should('have.length', 3)

      // First level-2 heading
      const firstL2Heading = firstSection.find('.heading[level="2"]').eq(0)
      firstL2Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      firstL2Heading
        .find('> .contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      firstL2Heading
        .find('> .contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)

      const l3Heading = firstL2Heading.find('.heading[level="3"]')
      // Verify nested level-3 heading in first level-2 heading
      l3Heading.should('have.length', 1)
      l3Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      l3Heading
        .find('> .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)

      // Verify level-4 heading inside level-3
      const l4Heading = l3Heading.find('.heading[level="4"]')
      l4Heading.should('have.length', 1)
      l4Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      l4Heading
        .find('> .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)

      // Second level-2 heading
      const secondL2Heading = firstSection.find('.heading[level="2"]').eq(1)
      secondL2Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      secondL2Heading
        .find('> .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.medium)

      // Third level-2 heading
      const thirdL2Heading = firstSection.find('.heading[level="2"]').eq(2)
      thirdL2Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      thirdL2Heading
        .find('> .contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      thirdL2Heading
        .find('> .contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })
  })

  describe('Second section verification', () => {
    let secondSection

    beforeEach(() => {
      secondSection = cy.get('.docy_editor .heading[level="1"]').eq(1)
    })

    it('Verifies section title and content', () => {
      secondSection.find('.title').first().should('contain.text', TEST_TITLE.medium)
      secondSection
        .find('> .contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      secondSection
        .find('> .contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies level-3 heading and its nested content', () => {
      const l3Heading = secondSection.find('.heading[level="3"]')
      l3Heading.should('have.length', 1)
      l3Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      l3Heading
        .find('> .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)

      // Verify level-4 heading inside level-3
      const l4Heading = l3Heading.find('.heading[level="4"]')
      l4Heading.should('have.length', 1)
      l4Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      l4Heading
        .find('> .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)
    })
  })

  describe('Third section verification', () => {
    let thirdSection

    beforeEach(() => {
      thirdSection = cy.get('.docy_editor .heading[level="1"]').eq(2)
    })

    it('Verifies section title and content', () => {
      thirdSection.find('.title').first().should('contain.text', TEST_TITLE.short)
      thirdSection
        .find('> .contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      thirdSection
        .find('> .contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies level-8 heading and its content', () => {
      const l8Heading = thirdSection.find('.heading[level="8"]')
      l8Heading.should('have.length', 1)
      l8Heading.find('.title').first().should('contain.text', TEST_TITLE.short)
      l8Heading
        .find('> .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies nested bullet list structure', () => {
      const l8Heading = thirdSection.find('.heading[level="8"]')

      l8Heading
        .find('ul')
        .first()
        .within(() => {
          cy.get('li').should('have.length', 4)
          cy.get('li').eq(0).should('contain.text', 'Initial point')

          // Verify nested list items with proper indentation
          cy.get('li').eq(1).should('contain.text', 'Supporting detail 1')
          cy.get('li').eq(2).should('contain.text', 'Supporting detail 2')
          cy.get('li').eq(3).should('contain.text', 'Supporting detail 3')
        })

      // Verify paragraph after list
      l8Heading.find('ul').first().next('p').should('contain.text', TEST_CONTENT.short)
    })
  })
})
