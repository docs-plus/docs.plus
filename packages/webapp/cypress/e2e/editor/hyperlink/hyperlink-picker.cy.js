/* eslint-disable no-undef */

import { heading, paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'
import {
  ADD_LINK_KEYS,
  PICKER_SELECTORS as S,
  setupBookmarkSuggestions,
  TEST_BOOKMARKS
} from '../../../support/hyperlinkPicker'

/**
 * Build a section with the given titles as flat H2 children. Each H2 carries
 * a non-empty body paragraph: `heading(_, _, [])` injects an empty fallback
 * paragraph that trips the breadcrumb-placeholder plugin
 * (`Position N out of range` in `collectPrecedingHeadingRefs`).
 */
const docWithHeadings = (titles) =>
  section(
    TEST_TITLE.HelloDocy,
    titles.map((t) => heading(2, t, [paragraph(`${t} body`)]))
  )

/** Place the caret at the end of the doc so `realType` lands in a known spot. */
const focusEnd = () => {
  cy.window().then((w) => {
    if (!w._editor) throw new Error('window._editor missing')
    w._editor.chain().focus('end').run()
  })
}

describe('Hyperlink suggestion picker', () => {
  describe('create / pick a heading', () => {
    beforeEach(() => {
      cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-picker-create' })
      cy.createDocument(docWithHeadings(['Methods', 'Setup', 'Conclusion']))
      cy.get(S.pm).should('be.visible')
    })

    it('expand → click row inserts a heading deep-link with the picked title', () => {
      focusEnd()
      cy.get(S.pm).realType('See the ')
      cy.realPress(ADD_LINK_KEYS)
      cy.get(S.createPopover).should('exist')

      cy.get(S.createPopover).find(S.expand).click()
      cy.get(S.createPopover).find(S.headingRow).contains('Setup').click()

      cy.get(S.editorLink)
        .should('contain.text', 'Setup')
        .and('have.attr', 'href')
        .and('match', /\?h=[^&]*setup&id=/)
    })

    it('with a selection, picking a heading links the selected text (does NOT replace it)', () => {
      const ANCHOR = 'see-the-setup'
      focusEnd()
      cy.get(S.pm).realType(`Read ${ANCHOR} carefully`)

      // Select ANCHOR so the picker has a non-empty selection to link against.
      cy.window().then((w) => {
        const editor = w._editor
        let from
        let to
        editor.state.doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return
          const offset = node.text.indexOf(ANCHOR)
          if (offset === -1) return
          from = pos + offset
          to = from + ANCHOR.length
        })
        editor.chain().focus().setTextSelection({ from, to }).run()
      })

      cy.realPress(ADD_LINK_KEYS)
      cy.get(S.createPopover).find(S.expand).click()
      cy.get(S.createPopover).find(S.headingRow).contains('Setup').click()

      cy.get(S.editorLink)
        .should('contain.text', ANCHOR)
        .and('not.contain.text', 'Setup')
        .and('have.attr', 'href')
        .and('match', /\?h=[^&]*setup&id=/)
    })

    it('ArrowDown opens the panel and Enter picks the highlighted heading', () => {
      focusEnd()
      cy.get(S.pm).realType('Pick: ')
      cy.realPress(ADD_LINK_KEYS)

      // Doc order: [H1 Hello…, H2 Methods, H2 Setup, H2 Conclusion].
      // 1st ArrowDown opens panel (highlight stays null);
      // 2nd seeks to index 0; 3rd → 1; 4th → 2 ("Setup").
      cy.get(S.createPopover).find(S.urlInput).should('be.focused').type('{downArrow}')
      cy.get(S.createPopover).find(S.row).should('have.length.at.least', 4)
      cy.get(S.createPopover).find(S.urlInput).type('{downArrow}{downArrow}{downArrow}{enter}')

      cy.get(S.editorLink)
        .should('contain.text', 'Setup')
        .and('have.attr', 'href')
        .and('match', /\?h=[^&]*setup&id=/)
    })
  })

  describe('create / pick a bookmark', () => {
    beforeEach(() => {
      cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-picker-bookmark' })
      cy.createDocument(docWithHeadings(['Notes']))
      setupBookmarkSuggestions()
      cy.get(S.pm).should('be.visible')
    })

    it('renders the Bookmarks section with the archived badge after expanding', () => {
      focusEnd()
      cy.get(S.pm).realType('See ')
      cy.realPress(ADD_LINK_KEYS)
      cy.get(S.createPopover).find(S.expand).click()
      cy.wait('@getUserBookmarks')

      cy.get(S.createPopover).contains('Bookmarks').should('be.visible')
      cy.get(S.createPopover).find(S.bookmarkRow).should('have.length', 2)
      cy.get(S.createPopover)
        .find(S.bookmarkRow)
        .filter(':contains("Old retrospective")')
        .should('contain.text', 'Archived')
    })

    it('clicking a bookmark inserts a chatroom deep-link with the bookmark title', () => {
      focusEnd()
      cy.get(S.pm).realType('See ')
      cy.realPress(ADD_LINK_KEYS)
      cy.get(S.createPopover).find(S.expand).click()
      cy.wait('@getUserBookmarks')

      cy.get(S.createPopover)
        .find(S.bookmarkRow)
        .contains(TEST_BOOKMARKS.active.message_content)
        .click()

      cy.get(S.editorLink)
        .should('contain.text', TEST_BOOKMARKS.active.message_content)
        .and('have.attr', 'href')
        .and('include', `msg_id=${TEST_BOOKMARKS.active.message_id}`)
        .and('include', `chatroom=${TEST_BOOKMARKS.active.message_channel_id}`)
    })
  })

  describe('create / typed URL', () => {
    const TARGET = 'highlight-me'

    /** Select a known word so `setMark` has a non-empty range to write to. */
    const selectTarget = () => {
      cy.window().then((w) => {
        const editor = w._editor
        if (!editor) throw new Error('window._editor missing')
        let from
        let to
        editor.state.doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return
          const offset = node.text.indexOf(TARGET)
          if (offset === -1) return
          from = pos + offset
          to = from + TARGET.length
        })
        if (from === undefined || to === undefined) throw new Error(`target "${TARGET}" not found`)
        editor.chain().focus().setTextSelection({ from, to }).run()
      })
    }

    beforeEach(() => {
      cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-picker-typed' })
      cy.createDocument(docWithHeadings(['Setup Guide', 'Setup Helpers']))
      cy.get(S.pm).should('be.visible')
      focusEnd()
      cy.get(S.pm).realType(`Link: ${TARGET} more`)
    })

    it('typing in the URL field filters the heading list by title', () => {
      selectTarget()
      cy.realPress(ADD_LINK_KEYS)
      cy.get(S.createPopover).find(S.urlInput).type('setup')

      cy.get(S.createPopover).find(S.headingRow).should('have.length', 2)
      cy.get(S.createPopover).find(S.headingRow).contains('Setup Guide').should('be.visible')
      cy.get(S.createPopover).contains(S.headingRow, 'Hello Docsplus World').should('not.exist')
    })

    it('a URL-shaped query bypasses suggestions; Apply commits it verbatim onto the selection', () => {
      selectTarget()
      cy.realPress(ADD_LINK_KEYS)
      cy.get(S.createPopover).find(S.urlInput).type('https://example.test/page')
      cy.get(S.createPopover).find(S.submit).click()

      cy.get(S.editorLink)
        .should('contain.text', TARGET)
        .and('have.attr', 'href', 'https://example.test/page')
    })
  })

  describe('edit / pick a target via picker', () => {
    const SEED_HREF = 'https://seed.test/old'
    const SEED_TEXT = 'Methods body'

    /** Programmatically mark `SEED_TEXT` as a hyperlink — same shape as the
     * working `insertHyperlink` helper in `hyperlink-preview-edit.cy.js`. */
    const seedHyperlink = () => {
      cy.window().then((w) => {
        const editor = w._editor
        if (!editor) throw new Error('window._editor missing')
        let from
        let to
        editor.state.doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return
          const offset = node.text.indexOf(SEED_TEXT)
          if (offset === -1) return
          from = pos + offset
          to = from + SEED_TEXT.length
        })
        if (from === undefined || to === undefined) {
          throw new Error(`seed text "${SEED_TEXT}" not found`)
        }
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .setMark('hyperlink', { href: SEED_HREF })
          .run()
      })
    }

    beforeEach(() => {
      // Tiptap occasionally throws "mismatched transaction" when collab is
      // off and selection-mutating chains race the popover; mirrors the
      // guard in `hyperlink-preview-edit.cy.js`.
      cy.on('uncaught:exception', (err) => {
        if (err.message.includes('mismatched transaction')) return false
      })
      cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-picker-edit' })
      cy.createDocument(docWithHeadings(['Methods', 'Setup']))
      cy.get(S.pm).should('be.visible')
      seedHyperlink()
      cy.get(S.editorLink).should('exist')
    })

    /**
     * ProseMirror's `handleClick` doesn't trigger on Cypress `realClick()` —
     * dispatch a native `MouseEvent` with viewport coords so the extension's
     * click handler runs and the preview popover opens.
     */
    const openEditPopover = () => {
      cy.get(S.editorLink)
        .should('be.visible')
        .then(($el) => {
          const el = $el[0]
          const rect = el.getBoundingClientRect()
          el.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
              button: 0,
              view: el.ownerDocument.defaultView
            })
          )
        })
      cy.wait(500)
      cy.get('.hyperlink-preview-popover').should('be.visible')
      cy.get('.hyperlink-preview-popover button.edit').click()
      cy.get(S.editPopover).should('be.visible')
    }

    it('picks a heading and re-points href without touching the existing link text', () => {
      openEditPopover()
      cy.get(S.editPopover).find(S.expand).click()
      cy.get(S.editPopover).find(S.headingRow).contains('Setup').click()

      // The picker is a target chooser — the existing anchor text
      // (`SEED_TEXT`) must survive; only the href updates.
      cy.get(S.editorLink)
        .should('contain.text', SEED_TEXT)
        .and('not.contain.text', 'Setup')
        .and('have.attr', 'href')
        .and('match', /\?h=[^&]*setup&id=/)
    })

    it('preserves a user-edited link text (textTouched) when picking a heading', () => {
      openEditPopover()
      cy.get(S.editPopover).find(S.textInput).clear().type('Custom Anchor')
      cy.get(S.editPopover).find(S.expand).click()
      cy.get(S.editPopover).find(S.headingRow).contains('Setup').click()

      cy.get(S.editorLink)
        .should('contain.text', 'Custom Anchor')
        .and('not.contain.text', 'Setup')
        .and('have.attr', 'href')
        .and('match', /\?h=[^&]*setup&id=/)
    })

    it('picks a bookmark and re-points href to the chatroom deep-link', () => {
      setupBookmarkSuggestions()
      openEditPopover()
      cy.get(S.editPopover).find(S.expand).click()
      cy.wait('@getUserBookmarks')

      cy.get(S.editPopover)
        .find(S.bookmarkRow)
        .contains(TEST_BOOKMARKS.active.message_content)
        .click()

      cy.get(S.editorLink)
        .should('have.attr', 'href')
        .and('include', `msg_id=${TEST_BOOKMARKS.active.message_id}`)
        .and('include', `chatroom=${TEST_BOOKMARKS.active.message_channel_id}`)
    })
  })
})
