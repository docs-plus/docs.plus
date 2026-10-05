/// <reference types="cypress" />

const SELECTED_HOST = '#editor .ProseMirror-selectednode > .hm-media-host'

/** Reads the painted frame, because the selected class alone can sit on an unframed node. */
export function expectSelectedFrame(): void {
  cy.get(SELECTED_HOST).should('have.length', 1)
  cy.get(SELECTED_HOST).should(($host) => {
    const host = $host[0]
    const frame = host.ownerDocument.defaultView!.getComputedStyle(host, '::after')
    expect(frame.borderTopStyle).to.eq('solid')
    expect(frame.borderTopWidth).to.eq('1px')
  })
}
