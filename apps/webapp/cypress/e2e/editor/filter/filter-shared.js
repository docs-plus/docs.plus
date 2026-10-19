/* eslint-disable no-undef */
/**
 * Filters live on the pad route: `useApplyFilters` mounts only in the pad session, and a
 * filter term is a path segment after the pad slug. The `/editor` playground has neither.
 * So these specs need the whole local stack (webapp, REST, WS) and seed a fresh pad.
 */

export const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

export const freshSlug = (name) =>
  `e2e-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const textNode = (text) => ({ type: 'text', text })
const headingNode = (level, text) => ({
  type: 'heading',
  attrs: { level },
  content: [textNode(text)]
})
const paragraphNode = (text) => ({ type: 'paragraph', content: [textNode(text)] })

/** The body paragraph itself: `cy.contains(editorSelector, text)` yields the whole editor. */
export const padParagraph = (text) => cy.get('.docy_editor .ProseMirror').contains('p', text)

/** A title H1, then one H2 section per `[title, body]` pair. */
export const sectionsDoc = (title, sections) => ({
  type: 'doc',
  content: [
    headingNode(1, title),
    ...sections.flatMap(([heading, body]) => [headingNode(2, heading), paragraphNode(body)])
  ]
})

/**
 * Opens a fresh pad and replaces its content once the editor is mounted. The server only
 * reads the user agent, so a mobile pad needs the header, not a narrow viewport.
 */
export const visitSeededPad = (slug, doc, { userAgent } = {}) => {
  cy.visit(`/${slug}`, userAgent ? { headers: { 'user-agent': userAgent } } : undefined)
  cy.get('.docy_editor .ProseMirror', { timeout: 40000 }).should(($pm) => {
    expect($pm[0].editor, 'TipTap editor on the pad').to.exist
  })
  cy.get('.docy_editor .ProseMirror').then(($pm) => {
    $pm[0].editor.commands.setContent(doc)
  })
  cy.get('.docy_editor .ProseMirror h2[data-toc-id]', { timeout: 10000 }).should('have.length', 2)
}
