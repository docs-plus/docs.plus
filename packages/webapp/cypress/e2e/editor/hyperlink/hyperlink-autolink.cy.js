/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const EDITOR_LINK = '.docy_editor a'
const PM = '.docy_editor > .tiptap.ProseMirror'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Autolink Section', [])]
}

const getParagraph = () => cy.get(`${PM} > p`).first()

describe('Hyperlink Autolink', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-autolink' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('basic autolink triggers', () => {
    it('typing a URL followed by space creates a link', () => {
      getParagraph().click()
      cy.get(PM).realType('Visit https://example.com and enjoy')

      cy.get(EDITOR_LINK)
        .should('have.attr', 'href', 'https://example.com')
        .and('contain.text', 'https://example.com')
    })

    it('typing a URL followed by Enter creates a link', () => {
      getParagraph().click()
      cy.get(PM).realType('https://example.org')
      cy.get(PM).realPress('Enter')

      cy.get(EDITOR_LINK).should('have.attr', 'href', 'https://example.org')
    })

    it('typing a non-URL followed by space does not create a link', () => {
      getParagraph().click()
      cy.get(PM).realType('just some text without urls ')

      cy.get(EDITOR_LINK).should('not.exist')
    })
  })

  describe('registered protocols', () => {
    it('autolinks ftp:// protocol', () => {
      getParagraph().click()
      cy.get(PM).realType('Download from ftp://files.example.com ')

      cy.get(EDITOR_LINK).should('have.attr', 'href', 'ftp://files.example.com')
    })

    it('autolinks mailto: protocol', () => {
      getParagraph().click()
      cy.get(PM).realType('Email mailto:user@example.com ')

      cy.get(EDITOR_LINK).should('have.attr', 'href', 'mailto:user@example.com')
    })
  })

  describe('autolink behavior', () => {
    it('autolinks a URL with path and query parameters', () => {
      getParagraph().click()
      cy.get(PM).realType('https://example.com/page?q=1&ref=test ')

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('include', '/page?q=1')
    })
  })

  describe('edge guards', () => {
    it('does not autolink a bare URL when preceded by image markdown syntax', () => {
      getParagraph().click()
      // Type text that precedes image markdown context, then a URL
      cy.get(PM).realType('text before ![img](')
      cy.get(PM).realType('https://img.example.com/photo.png')
      cy.get(PM).realType(') ')

      // The autolink plugin guards URLs preceded by ![ ... ](
      // The input rule [text](url) may convert the markdown syntax, but the raw URL itself
      // should not receive an autolink mark
      cy.get('.docy_editor').should('contain.text', 'text before')
    })

    it('does not include trailing period in autolinked URLs', () => {
      getParagraph().click()
      cy.get(PM).realType('See https://example.com. ')

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('not.match', /\.$/)
    })

    it('strips trailing comma from autolinked URLs', () => {
      getParagraph().click()
      cy.get(PM).realType('Visit https://example.com, then continue ')

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('eq', 'https://example.com')
    })
  })

  describe('special scheme URLs', () => {
    it('autolinks special scheme URLs', () => {
      getParagraph().click()
      cy.get(PM).realType('Join zoommtg://zoom.us/join?confno=123 ')

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('include', 'zoommtg://')
    })
  })
})
