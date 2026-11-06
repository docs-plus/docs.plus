/* eslint-disable no-undef */
import { describeOnPad, freshSlug } from '../filter/filter-shared'

// The tick rail mounts only on the pad route, so this spec needs REST and WS (#645).
const TARGET = 'Section 6'
const VIDEO = 'Video section'

const text = (value) => [{ type: 'text', text: value }]
const heading = (value) => ({ type: 'heading', attrs: { level: 2 }, content: text(value) })
const paragraph = (value) => ({ type: 'paragraph', content: text(value) })

const railDoc = () => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: text('Rail Preview Doc') },
    ...Array.from({ length: 12 }, (_, i) => [
      heading(`Section ${i + 1}`),
      paragraph(`Body of section ${i + 1}. `.repeat(30))
    ]).flat(),
    heading(VIDEO),
    { type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
    paragraph('After the video.')
  ]
})

const movePointer = (x, y) =>
  cy.window().then((win) => {
    win.dispatchEvent(
      new win.PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true })
    )
  })

// By id: a tick's name gains ", chat open" while its room is open.
const tickCenter = (label) =>
  cy
    .contains('.docy_editor .ProseMirror h2[data-toc-id]', label)
    .invoke('attr', 'data-toc-id')
    .then((id) => cy.get(`[data-toc-rail-stack] button[data-toc-id="${id}"]`))
    .then(($tick) => {
      const box = $tick[0].getBoundingClientRect()
      return { x: box.left + 12, y: box.top + box.height / 2 }
    })

const card = () => cy.get('[data-toc-rail-preview]')

/** Drags the TOC sash past the snap line, as a reader does, so the 32px rail mounts. */
const collapseToRail = () => {
  cy.get('[role="separator"][aria-orientation="vertical"]').then(($sash) => {
    const box = $sash[0].getBoundingClientRect()
    cy.wrap($sash).trigger('mousedown', {
      button: 0,
      clientX: box.left + box.width / 2,
      clientY: 300
    })
  })
  cy.document().trigger('mousemove', { clientX: 4, clientY: 300 })
  cy.document().trigger('mouseup', { clientX: 4, clientY: 300 })
  cy.get('[data-toc-rail-reopen]', { timeout: 5000 }).should('be.visible')
}

describeOnPad('TOC tick rail section preview', () => {
  let slug

  beforeEach(() => {
    cy.intercept({ url: /youtube(-nocookie)?\.com\/embed\// }, { statusCode: 200, body: '' }).as(
      'youtubeEmbed'
    )
    cy.viewport(1456, 1000)
    slug = freshSlug('toc-rail-preview')
    cy.visit(`/${slug}`)
    cy.get('.docy_editor .ProseMirror', { timeout: 40000 }).should(($pm) => {
      expect($pm[0].editor, 'TipTap editor on the pad').to.exist
    })
    cy.get('.docy_editor .ProseMirror').then(($pm) => {
      $pm[0].editor.commands.setContent(railDoc())
    })
    cy.get('.docy_editor .ProseMirror h2[data-toc-id]', { timeout: 10000 }).should(
      'have.length',
      13
    )
    cy.waitForToc()
    collapseToRail()
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('keeps the card on the path into it and opens that heading chat', () => {
    tickCenter(TARGET).then(({ x, y }) => {
      movePointer(x, y)
      card().should('have.attr', 'aria-label', TARGET)
      card().should('not.have.attr', 'aria-hidden')

      cy.get('.editorWrapper').then(($wrapper) => {
        const scrollTop = $wrapper[0].scrollTop

        card().then(($card) => {
          const box = $card[0].getBoundingClientRect()
          // Toward the action, the pointer overshoots the card top. Only the corridor holds it.
          const steps = 8
          const stopX = box.right - 10
          const stopY = box.top - 3
          for (let i = 1; i <= steps; i++) {
            movePointer(x + 18 + ((stopX - x - 18) * i) / steps, y + ((stopY - y) * i) / steps)
            cy.wait(20)
          }
          // A pause longer than the 120ms grace: the card must not close.
          cy.wait(400)
          card().should('have.attr', 'aria-label', TARGET)
        })

        cy.get('[data-toc-rail-preview-chat]').then(($action) => {
          const box = $action[0].getBoundingClientRect()
          movePointer(box.left + box.width / 2, box.top + box.height / 2)
        })
        cy.get('[data-toc-rail-preview-chat]')
          .should('have.attr', 'aria-label', `Open chatroom for ${TARGET}`)
          .click()

        cy.get('[data-toc-rail-preview]').should('not.exist')
        cy.get(`[role="region"][aria-label="Chat: ${TARGET}"]`, { timeout: 10000 }).should('exist')
        cy.get('.editorWrapper').should(($after) => {
          expect(Math.abs($after[0].scrollTop - scrollTop), 'document scroll').to.be.at.most(1)
        })
      })
    })

    // The open room shows its close action on the same heading's card. Chat moved the rail.
    cy.wait(400)
    tickCenter(TARGET).then(({ x, y }) => {
      movePointer(x + 400, y)
      movePointer(x, y)
      cy.get('[data-toc-rail-preview-chat]').should('have.attr', 'aria-label', 'Close chatroom')
      cy.get('[data-toc-rail-preview-chat]').click()
    })
    cy.get(`[role="region"][aria-label="Chat: ${TARGET}"]`).should('not.exist')
    cy.get('[data-toc-rail-preview]').should('not.exist')
    // The dismissed action is gone, so the close hands focus to the rail reopen button.
    cy.focused().should('have.attr', 'data-toc-rail-reopen')
  })

  it('closes 120ms after the pointer leaves, and a quick return keeps the card', () => {
    tickCenter(TARGET).then(({ x, y }) => {
      movePointer(x, y)
      card().should('have.attr', 'aria-label', TARGET)
      // Continuous movement outside must not push the close back.
      for (let i = 1; i <= 15; i++) {
        movePointer(800 + i * 4, y)
        cy.wait(20)
      }
      cy.get('[data-toc-rail-preview]', { timeout: 0 }).should('not.exist')

      movePointer(x, y)
      card().should('have.attr', 'aria-label', TARGET)
      movePointer(800, y)
      cy.wait(40)
      movePointer(x, y)
      cy.wait(300)
      card().should('have.attr', 'aria-label', TARGET)
    })
  })

  it('lets the keyboard own the card, enter it, and leave it with Escape', () => {
    cy.contains('.docy_editor .ProseMirror h2[data-toc-id]', TARGET)
      .invoke('attr', 'data-toc-id')
      .then((id) => {
        const tick = () => cy.get(`[data-toc-rail-stack] button[data-toc-id="${id}"]`)
        tick().focus()
        card().should('have.attr', 'aria-label', TARGET)
        // Pointer scrubbing cannot replace a card that keyboard focus owns.
        tickCenter('Section 2').then(({ x, y }) => movePointer(x, y))
        cy.wait(300)
        card().should('have.attr', 'aria-label', TARGET)

        tick().trigger('keydown', { key: 'Tab' })
        cy.focused().should('have.attr', 'data-toc-rail-preview-chat')
        cy.focused().trigger('keydown', { key: 'Escape' })
        card().should('not.exist')
        cy.focused().should('have.attr', 'data-toc-id', id)
        // Focus came back to the tick, but that is not a fresh entry.
        cy.wait(300)
        card().should('not.exist')
      })
  })

  it('shows a still tile for an embed and never loads a player', () => {
    cy.get('.docy_editor iframe').should('have.length', 1)
    cy.get('@youtubeEmbed.all').then((before) => {
      tickCenter(VIDEO).then(({ x, y }) => {
        movePointer(x, y)
        card().should('have.attr', 'aria-label', VIDEO)
        cy.wait(300)
        cy.get('@youtubeEmbed.all').should('have.length', before.length)
        card().find('iframe, video, audio').should('not.exist')
        card().find('[data-toc-preview-tile="youtube"]').should('exist')
      })
    })
  })
})
