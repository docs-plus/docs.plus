/* eslint-disable no-undef */
import { describeOnPad, freshSlug, sectionsDoc } from '../filter/filter-shared'

// The scroll spy mounts only on the pad route, so this spec needs REST and WS.
const SECTIONS = Array.from({ length: 40 }, (_, i) => [
  `Section ${i + 1}`,
  `Body of section ${i + 1}. `.repeat(60)
])
const TARGET = 'Section 32'
const LAND_TOLERANCE_PX = 16

describeOnPad('TOC click landing', () => {
  let slug

  beforeEach(() => {
    cy.viewport(1456, 1000)
    slug = freshSlug('toc-landing')
    cy.visit(`/${slug}`)
    cy.get('.docy_editor .ProseMirror', { timeout: 40000 }).should(($pm) => {
      expect($pm[0].editor, 'TipTap editor on the pad').to.exist
    })
    cy.get('.docy_editor .ProseMirror').then(($pm) => {
      $pm[0].editor.commands.setContent(sectionsDoc('Landing Doc', SECTIONS))
    })
    cy.get('.docy_editor .ProseMirror h2[data-toc-id]', { timeout: 10000 }).should(
      'have.length',
      SECTIONS.length
    )
    cy.waitForToc()
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('lands the clicked heading at the scroller top and keeps its row focused', () => {
    // The spy's first focus (the Title, at the top) lands after the document is set.
    cy.get('.tiptap__toc .toc__row.menu-focus').should('exist')
    // Late media or a diagram grows the page above the target while the smooth scroll runs.
    cy.get('.editorWrapper').then(($wrapper) => {
      $wrapper[0].addEventListener(
        'scroll',
        () => {
          $wrapper[0].querySelector('.tiptap__editor').style.paddingTop = '3000px'
        },
        { once: true }
      )
    })

    cy.getTocItem(TARGET).then(($item) => {
      const id = $item.attr('data-id')
      // The spy must not walk other rows while the page scrolls to the target.
      const strayFocus = []
      let recorder
      cy.window().then((win) => {
        recorder = new win.MutationObserver((records) => {
          for (const { target } of records) {
            if (!target.matches('.toc__row.menu-focus')) continue
            const rowId = target.closest('.toc__item')?.getAttribute('data-id')
            if (rowId !== id) strayFocus.push(target.textContent.trim())
          }
        })
        recorder.observe(win.document.querySelector('.tiptap__toc'), {
          subtree: true,
          attributes: true,
          attributeFilter: ['class']
        })
      })
      cy.wrap($item).find('> .toc__row .toc__link').click()

      cy.wait(1500).then(() => {
        recorder.disconnect()
        expect(strayFocus, 'rows that took spy focus during the scroll').to.deep.equal([])
      })
      cy.get('.editorWrapper').should(($wrapper) => {
        const heading = $wrapper[0].querySelector(`h2[data-toc-id="${id}"]`)
        const offset = heading.getBoundingClientRect().top - $wrapper[0].getBoundingClientRect().top
        expect(Math.abs(offset), 'heading offset from the scroller top').to.be.at.most(
          LAND_TOLERANCE_PX
        )
      })
      // A desktop click also opens the chat, so the clicked row shows menu-active.
      cy.get('.toc__list').should(($list) => {
        const row = $list.find(`.toc__item[data-id="${id}"] > .toc__row`)
        expect(row.is('.menu-active, .menu-focus'), 'clicked row is marked').to.equal(true)
        const otherFocus = $list
          .find('.toc__row.menu-focus')
          .filter((_, el) => el.closest('.toc__item')?.getAttribute('data-id') !== id)
        expect(otherFocus, 'no other row has spy focus').to.have.length(0)
      })
    })
  })
})
