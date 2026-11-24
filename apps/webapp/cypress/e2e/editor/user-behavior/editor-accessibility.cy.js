/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../fixtures/docMaker'

const EDITOR_SEL = '.docy_editor > .tiptap.ProseMirror'

describe('Editor Accessibility', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'editor-a11y-test' })
    cy.createDocument({
      sections: [section('Main Title', [heading(2, 'Section One', [paragraph('Body text')])])]
    })
  })

  it('exposes accessible roles and labels on editor, toolbar, and block style select', () => {
    cy.get(EDITOR_SEL)
      .should('have.attr', 'role', 'textbox')
      .and('have.attr', 'aria-label', 'Document editor')
      .and('have.attr', 'aria-multiline', 'true')

    cy.get('.tiptap__toolbar')
      .should('have.attr', 'role', 'toolbar')
      .and('have.attr', 'aria-label', 'Formatting')

    cy.get('.tiptap__toolbar button[aria-label="Block style"]')
      .should('have.attr', 'aria-haspopup', 'listbox')
      .and('have.attr', 'aria-expanded', 'false')
  })

  it('keeps hidden heading action buttons out of the accessibility tree and exposes them on hover', () => {
    cy.get('.pad.history_editor').invoke('removeClass', 'history_editor')

    cy.get('h2[data-toc-id] .ha-single').should('have.attr', 'aria-label', 'Open chat')
    cy.get('h2[data-toc-id] .ha-single').should('have.attr', 'aria-hidden', 'true')
    cy.get('h2[data-toc-id] .ha-single').should('have.attr', 'tabindex', '-1')

    cy.get('h2[data-toc-id] .ha-group').should('have.attr', 'aria-hidden', 'true')
    cy.get('h2[data-toc-id] .ha-group').should('have.prop', 'inert', true)

    cy.get('h2[data-toc-id] .ha-chat-btn svg').each(($svg) => {
      expect($svg.attr('aria-hidden')).to.eq('true')
    })

    cy.contains(`${EDITOR_SEL} > p`, 'Body text').realHover()

    cy.get('h2[data-toc-id] .ha-single').should('have.attr', 'aria-label', 'Open chat')
    cy.get('h2[data-toc-id] .ha-single').should('not.have.attr', 'aria-hidden')

    cy.get('.toolbars').realHover()

    cy.get('h2[data-toc-id] .ha-single').should('have.attr', 'aria-hidden', 'true')
    cy.get('h2[data-toc-id] .ha-single').should('have.attr', 'tabindex', '-1')
  })
})
