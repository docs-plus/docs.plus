/* eslint-disable no-undef */
import { TEST_CONTENT, TEST_TITLE } from '../../../support/commands'
import {
  heading,
  paragraph,
  listItem,
  orderedList,
  section,
  bulletList
} from '../../../fixtures/docMaker'

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
    const getFirstSection = () => cy.get('.docy_editor .heading[level="1"]').first()

    it('Verifies section title and initial content', () => {
      // Verify title
      getFirstSection().find('.title').first().should('contain.text', TEST_TITLE.short)

      // Verify initial paragraphs (inside contentWrapper > contents)
      getFirstSection()
        .find('.contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.short)
      getFirstSection()
        .find('.contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies ordered list structure', () => {
      getFirstSection()
        .find('ol')
        .within(() => {
          cy.get('li').should('have.length', 2)
          cy.get('li').eq(0).should('contain.text', 'Initial point')
          cy.get('li').eq(1).should('contain.text', 'Supporting detail')
        })
    })

    it('Verifies level-2 headings structure', () => {
      const getH2 = (idx) => getFirstSection().find('.heading[level="2"]').eq(idx)

      getFirstSection().find('.heading[level="2"]').should('have.length', 3)

      // First level-2 heading: title, paragraphs, and nested headings
      getH2(0).find('.title').first().should('contain.text', TEST_TITLE.short)
      getH2(0)
        .find('> .wrapBlock > .contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      getH2(0)
        .find('> .wrapBlock > .contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)

      // Level-3 heading inside first level-2
      getH2(0).find('.heading[level="3"]').should('have.length', 1)
      getH2(0)
        .find('.heading[level="3"]')
        .find('.title')
        .first()
        .should('contain.text', TEST_TITLE.short)
      getH2(0)
        .find('.heading[level="3"] > .wrapBlock > .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)

      // Level-4 heading inside level-3
      getH2(0).find('.heading[level="4"]').should('have.length', 1)
      getH2(0)
        .find('.heading[level="4"]')
        .find('.title')
        .first()
        .should('contain.text', TEST_TITLE.short)
      getH2(0)
        .find('.heading[level="4"] > .wrapBlock > .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)

      // Second level-2 heading
      getH2(1).find('.title').first().should('contain.text', TEST_TITLE.short)
      getH2(1)
        .find('> .wrapBlock > .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.medium)

      // Third level-2 heading
      getH2(2).find('.title').first().should('contain.text', TEST_TITLE.short)
      getH2(2)
        .find('> .wrapBlock > .contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      getH2(2)
        .find('> .wrapBlock > .contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })
  })

  describe('Second section verification', () => {
    const getSecondSection = () => cy.get('.docy_editor .heading[level="1"]').eq(1)

    it('Verifies section title and content', () => {
      getSecondSection().find('.title').first().should('contain.text', TEST_TITLE.medium)
      getSecondSection()
        .find('.contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      getSecondSection()
        .find('.contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies level-3 heading and its nested content', () => {
      const getH3 = () => getSecondSection().find('.heading[level="3"]')

      getH3().should('have.length', 1)
      getH3().find('.title').first().should('contain.text', TEST_TITLE.short)
      getH3()
        .find('> .wrapBlock > .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)

      // Level-4 heading inside level-3
      getH3().find('.heading[level="4"]').should('have.length', 1)
      getH3()
        .find('.heading[level="4"]')
        .find('.title')
        .first()
        .should('contain.text', TEST_TITLE.short)
      getH3()
        .find('.heading[level="4"] > .wrapBlock > .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)
    })
  })

  describe('Third section verification', () => {
    const getThirdSection = () => cy.get('.docy_editor .heading[level="1"]').eq(2)

    it('Verifies section title and content', () => {
      getThirdSection().find('.title').first().should('contain.text', TEST_TITLE.short)
      getThirdSection()
        .find('.contentWrapper .contents > p')
        .eq(0)
        .should('contain.text', TEST_CONTENT.medium)
      getThirdSection()
        .find('.contentWrapper .contents > p')
        .eq(1)
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies level-8 heading and its content', () => {
      const getH8 = () => getThirdSection().find('.heading[level="8"]')

      getH8().should('have.length', 1)
      getH8().find('.title').first().should('contain.text', TEST_TITLE.short)
      getH8()
        .find('> .wrapBlock > .contentWrapper .contents > p')
        .first()
        .should('contain.text', TEST_CONTENT.short)
    })

    it('Verifies nested bullet list structure', () => {
      const getH8 = () => getThirdSection().find('.heading[level="8"]')

      getH8()
        .find('ul')
        .first()
        .within(() => {
          cy.get('li').should('have.length', 4)
          cy.get('li').eq(0).should('contain.text', 'Initial point')
          cy.get('li').eq(1).should('contain.text', 'Supporting detail 1')
          cy.get('li').eq(2).should('contain.text', 'Supporting detail 2')
          cy.get('li').eq(3).should('contain.text', 'Supporting detail 3')
        })

      getH8().find('ul').first().next('p').should('contain.text', TEST_CONTENT.short)
    })
  })
})
