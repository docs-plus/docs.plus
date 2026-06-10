/// <reference types="cypress" />

const PREVIEW = '.hyperlink-preview-popover'
const EDIT = '.hyperlink-edit-popover'
const TEXT_INPUT = `${EDIT} .text-wrapper input`
const URL_INPUT = `${EDIT} .href-wrapper input`
const APPLY = `${EDIT} .apply-button`
const BACK = `${EDIT} .back-button`

const DOC_WITH_LINK = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>'

describe('previewHyperlinkPopover + editHyperlinkPopover — prebuilt preview / edit flow', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent(DOC_WITH_LINK)
  })

  describe('preview popover', () => {
    it('opens on click with the href, copy, edit, and remove buttons', () => {
      cy.get('#editor a').click()
      cy.get(PREVIEW)
        .should('be.visible')
        .within(() => {
          // The preview reads the stored mark attr (not `link.href`), so
          // the displayed URL is exactly what we stored — no trailing
          // slash, no origin leakage.
          cy.get('a').invoke('attr', 'href').should('eq', 'https://example.com')
          cy.get('button.copy').should('exist')
          cy.get('button.edit').should('exist')
          cy.get('button.remove').should('exist')
        })
    })

    it('does not leak the host page origin into the displayed href (relative-href regression)', () => {
      // Direct parse of `<a href="google.com">` — bypasses our write-side
      // normalization the way an external consumer or pasted HTML would.
      // The preview MUST display the stored attribute ("google.com"),
      // never the browser-resolved `http://<origin>/google.com` that
      // `link.href` (DOM property) would return.
      cy.setEditorContent('<p>Broken <a href="google.com">link</a>.</p>')
      cy.get('#editor a').click()
      cy.get(PREVIEW).find('a').invoke('attr', 'href').should('eq', 'google.com')
    })

    it('does not open the link in a new tab on click (a-tag is intercepted)', () => {
      const win = cy.stub().as('windowOpen')
      cy.on('window:before:load', (w) => {
        w.open = win as typeof w.open
      })
      cy.get('#editor a').click()
      cy.get(PREVIEW).should('be.visible')
      cy.get('@windowOpen').should('not.have.been.called')
    })

    it('removes the link when Remove is clicked', () => {
      cy.get('#editor a').click()
      cy.get(`${PREVIEW} .remove`).click()
      cy.get('#editor a').should('not.exist')
      cy.get(PREVIEW).should('not.exist')
    })

    it('dismisses on outside click', () => {
      cy.get('#editor a').click()
      cy.get(PREVIEW).should('be.visible')
      cy.get('body').click('topLeft')
      cy.get(PREVIEW).should('not.exist')
    })

    it('dismisses on Escape when focus is inside the toolbar', () => {
      // The Escape handler is attached to the floating-popover element, so focus
      // must live inside it for the key to reach the listener — this matches the
      // behavior of the create popover where the input is auto-focused.
      cy.get('#editor a').click()
      cy.get(PREVIEW).should('be.visible')
      cy.get(`${PREVIEW} .edit`).focus()
      cy.focused().realPress('Escape')
      cy.get(PREVIEW).should('not.exist')
    })
  })

  describe('edit popover', () => {
    beforeEach(() => {
      cy.get('#editor a').click()
      cy.get(`${PREVIEW} .edit`).click()
      cy.get(EDIT).should('be.visible')
    })

    it('prefills with the current text and href', () => {
      cy.get(TEXT_INPUT).should('have.value', 'Example')
      cy.get(URL_INPUT).invoke('val').should('contain', 'example.com')
    })

    it('updates href and text on Apply', () => {
      cy.get(TEXT_INPUT).clear().type('New Label')
      cy.get(URL_INPUT).clear().type('https://new.example.com')
      cy.get(APPLY).click()
      cy.get(EDIT).should('not.exist')
      cy.get('#editor a').should('have.attr', 'href', 'https://new.example.com')
      cy.get('#editor a').should('contain.text', 'New Label')
    })

    it('shows a validation error when the URL is invalid', () => {
      cy.get(URL_INPUT).clear().type('not a url')
      cy.get(APPLY).click()
      cy.get(EDIT).should('be.visible') // remains open
      cy.get(`${EDIT} .href-wrapper`).should('have.class', 'error')
      cy.get('#editor a').should('have.attr', 'href', 'https://example.com')
    })

    it('shows a validation error when the text is empty', () => {
      cy.get(TEXT_INPUT).clear()
      cy.get(APPLY).click()
      cy.get(EDIT).should('be.visible')
      cy.get(`${EDIT} .text-wrapper`).should('have.class', 'error')
    })

    it('returns to the preview popover on Back', () => {
      cy.get(BACK).click()
      cy.get(EDIT).should('not.exist')
      cy.get(PREVIEW).should('be.visible')
    })
  })

  describe('multi-link flows', () => {
    it('Back shows the preview of the link whose edit was opened last (stash integrity)', () => {
      cy.setEditorContent(
        '<p><a href="https://alpha.example">Alpha</a> and <a href="https://beta.example">Beta</a>.</p>'
      )
      // Enter A's edit, then click link B mid-edit — the click replaces the
      // edit popover with B's preview, which must also replace the stash.
      cy.get('#editor a').eq(0).click()
      cy.get(`${PREVIEW} .edit`).click()
      cy.get(EDIT).should('be.visible')
      cy.get('#editor a').eq(1).click()
      cy.get(PREVIEW).should('be.visible')
      cy.get(`${PREVIEW} .edit`).click()
      cy.get(EDIT).should('be.visible')
      cy.get(BACK).click()
      cy.get(PREVIEW).find('a').invoke('attr', 'href').should('eq', 'https://beta.example')
    })

    it('editing the second of two byte-identical links leaves the first unchanged', () => {
      cy.setEditorContent(
        '<p><a href="https://example.com">same</a> and <a href="https://example.com">same</a>.</p>'
      )
      cy.get('#editor a').eq(1).click()
      cy.get(`${PREVIEW} .edit`).click()
      cy.get(TEXT_INPUT).clear().type('changed')
      cy.get(URL_INPUT).clear().type('https://changed.example')
      cy.get(APPLY).click()
      cy.get(EDIT).should('not.exist')
      cy.get('#editor a').should('have.length', 2)
      cy.get('#editor a')
        .eq(0)
        .should('have.attr', 'href', 'https://example.com')
        .and('contain.text', 'same')
      cy.get('#editor a')
        .eq(1)
        .should('have.attr', 'href', 'https://changed.example')
        .and('contain.text', 'changed')
    })
  })

  describe('co-located marks', () => {
    it('preserves bold inside the link when only the URL changes', () => {
      // Pins the in-place mark swap in editHyperlink: an unchanged text
      // field must not rebuild the text node and drop sibling marks.
      cy.setEditorContent('<p><a href="https://x.com"><strong>bold</strong></a></p>')
      cy.get('#editor a').click()
      cy.get(`${PREVIEW} .edit`).click()
      cy.get(EDIT).should('be.visible')
      cy.get(URL_INPUT).clear().type('https://changed.example')
      cy.get(APPLY).click()
      cy.get(EDIT).should('not.exist')
      cy.get('#editor a strong').should('exist')
      cy.get('#editor a').should('have.attr', 'href', 'https://changed.example')
    })
  })

  describe('DOM contract', () => {
    it('preview popover uses documented class names', () => {
      cy.get('#editor a').click()
      cy.get(PREVIEW).within(() => {
        cy.get('a').should('exist')
        cy.get('.copy').should('exist')
        cy.get('.edit').should('exist')
        cy.get('.remove').should('exist')
      })
    })

    it('edit popover uses documented class names', () => {
      cy.get('#editor a').click()
      cy.get(`${PREVIEW} .edit`).click()
      cy.get(EDIT).within(() => {
        cy.get('.inputs-wrapper .text-wrapper input').should('exist')
        cy.get('.inputs-wrapper .href-wrapper input').should('exist')
        cy.get('.buttons-wrapper .back-button').should('exist')
        cy.get('.buttons-wrapper .apply-button').should('exist')
      })
    })
  })
})

// Module scope: keeps top-level consts (PREVIEW/EDIT/DOC_WITH_LINK/…) from
// colliding with sibling specs under Cypress's shared TS project.
export {}
