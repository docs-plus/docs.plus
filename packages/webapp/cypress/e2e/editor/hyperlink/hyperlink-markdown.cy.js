/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const EDITOR_LINK = '.docy_editor a'
const PM = '.docy_editor > .tiptap.ProseMirror'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Markdown Link Section', [])]
}

const getParagraph = () => cy.get(`${PM} > p`).first()

describe('Hyperlink Markdown Input Rule', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-markdown' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('typing [text](url) converts to a hyperlink', () => {
    getParagraph().click()
    cy.get(PM).realType('Check [Example](https://example.com) here')

    cy.get(EDITOR_LINK)
      .should('have.attr', 'href', 'https://example.com')
      .and('contain.text', 'Example')
  })

  it('adds https:// prefix for bare domain in markdown syntax', () => {
    getParagraph().click()
    cy.get(PM).realType('[Google](google.com)')

    cy.get(EDITOR_LINK)
      .should('have.attr', 'href', 'https://google.com')
      .and('contain.text', 'Google')
  })

  it('preserves protocol-relative URLs', () => {
    getParagraph().click()
    cy.get(PM).realType('[CDN](//cdn.example.com/file.js)')

    cy.get(EDITOR_LINK)
      .should('have.attr', 'href', '//cdn.example.com/file.js')
      .and('contain.text', 'CDN')
  })

  it('preserves explicit http:// in markdown syntax', () => {
    getParagraph().click()
    cy.get(PM).realType('[HTTP](http://example.com)')

    cy.get(EDITOR_LINK)
      .should('have.attr', 'href', 'http://example.com')
      .and('contain.text', 'HTTP')
  })

  it('image syntax ![alt](url) still triggers markdown input rule', () => {
    getParagraph().click()
    cy.get(PM).realType('![Logo](https://img.example.com/logo.png)')

    // The input rule matches [text](url) without a negative lookbehind for '!'
    // so ![alt](url) produces a link for 'Logo'. This is a known limitation.
    cy.get(EDITOR_LINK)
      .should('have.attr', 'href', 'https://img.example.com/logo.png')
      .and('contain.text', 'Logo')
  })

  it('handles URL with query parameters and fragments', () => {
    getParagraph().click()
    cy.get(PM).realType('[Docs](https://example.com/path?q=search&lang=en#section)')

    cy.get(EDITOR_LINK)
      .should('have.attr', 'href', 'https://example.com/path?q=search&lang=en#section')
      .and('contain.text', 'Docs')
  })

  it('creates link with multi-word link text', () => {
    getParagraph().click()
    cy.get(PM).realType('[Click here for more](https://example.com)')

    cy.get(EDITOR_LINK)
      .should('have.attr', 'href', 'https://example.com')
      .and('contain.text', 'Click here for more')
  })
})
