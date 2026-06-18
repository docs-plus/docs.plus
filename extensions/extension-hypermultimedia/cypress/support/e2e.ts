/// <reference types="cypress" />

/**
 * Support file for the extension-hypermultimedia clean-room E2E suite.
 * Single flat file (Cypress 15's JIT loader silently skips extensionless
 * split imports).
 */

import type * as HyperMultimediaModule from '@docs.plus/extension-hypermultimedia'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
// Type-only: pulls in StarterKit's command augmentations (undo/redo) for specs.
import type {} from '@tiptap/starter-kit'

import 'cypress-real-events'

const SCROLL_PX = 200
const REPOSITION_WAIT_MS = 100
const SETTLE_MS = 200

declare global {
  interface Window {
    _editor: Editor
    _hypermultimedia: typeof HyperMultimediaModule
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      visitPlayground(search?: string): Chainable<void>
      expectMediaLoadingPending(providerLabel?: string, scope?: string): Chainable<void>
      expectMediaLoadingReady(scope?: string, timeout?: number): Chainable<void>
      expectMediaLoadingError(message?: string, scope?: string): Chainable<void>
      getEditor(): Chainable<Editor>
      /** Count nodes of a given type name in the current doc. */
      nodeCount(typeName: string): Chainable<number>
      setEditorContent(html: string): Chainable<void>
      pastePlainText(text: string): Chainable<void>
      /** Paste a PNG file like a screenshot (fires editorFileUpload in the extension). */
      pasteImageFile(): Chainable<void>
      insertSizedImage(width: number, height: number): Chainable<void>
      prepareImageForResize(width: number, height: number): Chainable<void>
      activateImageGripper(): Chainable<void>
      hoverMediaControls(selector: string): Chainable<void>
      /** Drag an active gripper handle (`right`, `left`, `bottom`, `bottom-right`, …). */
      dragResizeClamp(edge: string, deltaX: number, deltaY?: number): Chainable<void>
      /** Assert rendered layout box matches expected size (not attrs alone). */
      expectRenderedMediaSize(
        selector: string,
        axis: 'width' | 'height',
        expected: number,
        tolerancePx?: number
      ): Chainable<void>
      nodeAttr(typeName: string, attr: string): Chainable<string | null>
      expectToolbarFollowsAnchor(
        toolbarSelector: string,
        anchorSelector: string,
        tolerancePx?: number
      ): Chainable<void>
    }
  }
}

Cypress.Commands.add('visitPlayground', (search = '') => {
  const path = search ? `/?${search.replace(/^\?/, '')}` : '/'
  cy.visit(path)
  cy.window({ timeout: 10000 }).should('have.property', '_editor')
  cy.window().its('_editor').should('be.an', 'object')
  cy.window().should('have.property', '_hypermultimedia')
})

function scoped(scope: string, selector: string): string {
  return scope === '#editor' ? `#editor ${selector}` : `${scope} ${selector}`
}

function loadingHost(scope: string, state: string, timeout?: number) {
  return cy.get(
    scoped(scope, `.hm-media-host[data-hm-loading="${state}"]`),
    timeout != null ? { timeout } : undefined
  )
}

function expectNoPendingLoadingHost(scope: string): void {
  loadingHost(scope, 'pending').should('not.exist')
}

Cypress.Commands.add('expectMediaLoadingPending', (providerLabel?: string, scope = '#editor') => {
  loadingHost(scope, 'pending').should('exist')
  cy.get(scoped(scope, '.hm-loading-shell__overlay')).should('exist')
  if (providerLabel) {
    cy.get(scoped(scope, '.hm-loading-shell__provider')).should('contain.text', providerLabel)
  }
})

Cypress.Commands.add('expectMediaLoadingReady', (scope = '#editor', timeout = 20000) => {
  loadingHost(scope, 'ready', timeout).should('exist')
  expectNoPendingLoadingHost(scope)
})

Cypress.Commands.add('expectMediaLoadingError', (message?: string, scope = '#editor') => {
  loadingHost(scope, 'error', 10000).should('exist')
  expectNoPendingLoadingHost(scope)
  cy.get(scoped(scope, '.hm-loading-shell__overlay')).should('be.visible')
  cy.get(scoped(scope, '.hm-loading-shell__shimmer')).should('not.be.visible')
  if (message) {
    cy.get(scoped(scope, '.hm-loading-shell__message')).should('contain.text', message)
  }
})

Cypress.Commands.add('getEditor', () => {
  return cy.window().its('_editor')
})

Cypress.Commands.add('nodeCount', (typeName: string) => {
  return cy.getEditor().then((editor) => {
    let count = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === typeName) count += 1
    })
    return count
  })
})

Cypress.Commands.add('setEditorContent', (html: string) => {
  cy.getEditor().then((editor) => {
    editor.commands.setContent(html)
  })
})

Cypress.Commands.add('pastePlainText', (text: string) => {
  cy.window().then((win) => {
    const dt = new win.DataTransfer()
    dt.setData('text/plain', text)
    cy.get('#editor .ProseMirror').trigger('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    })
  })
})

/** 1×1 PNG — enough for HyperImagePastePlugin to detect image/* on the clipboard. */
export const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

Cypress.Commands.add('pasteImageFile', () => {
  cy.window().then(async (win) => {
    const blob = await Cypress.Blob.base64StringToBlob(TINY_PNG_BASE64, 'image/png')
    const file = new win.File([blob], 'pasted.png', { type: 'image/png' })
    const dt = new win.DataTransfer()
    dt.items.add(file)
    cy.get('#editor .ProseMirror').trigger('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    })
  })
})

Cypress.Commands.add('insertSizedImage', (width: number, height: number) => {
  cy.getEditor().then((editor) => {
    editor.commands.setImage({
      src: 'https://example.com/photo.png',
      width,
      height
    })
  })
})

Cypress.Commands.add('activateImageGripper', () => {
  cy.get('#editor img').trigger('mouseover', { force: true })
  cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
})

Cypress.Commands.add('hoverMediaControls', (selector: string) => {
  cy.get(selector).trigger('mouseover', { force: true })
})

Cypress.Commands.add('prepareImageForResize', (width: number, height: number) => {
  cy.insertSizedImage(width, height)
  cy.activateImageGripper()
})

const activeClamp = (edge: string) =>
  `#editor .hypermultimedia__resize-gripper--active .media-resize-clamp--${edge}`

Cypress.Commands.add('dragResizeClamp', (edge: string, deltaX: number, deltaY = 0) => {
  cy.get(activeClamp(edge)).then(($clamp) => {
    const rect = $clamp[0].getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    cy.wrap($clamp).realMouseDown({ position: 'center' })
    cy.get('body').realMouseMove(x + deltaX, y + deltaY)
    cy.get('body').realMouseUp()
  })
})

Cypress.Commands.add(
  'expectRenderedMediaSize',
  (selector: string, axis: 'width' | 'height', expected: number, tolerancePx = 2) => {
    cy.get(selector).should(($el) => {
      expect(
        $el[0].getBoundingClientRect()[axis],
        `${selector} getBoundingClientRect().${axis}`
      ).to.be.closeTo(expected, tolerancePx)
    })
  }
)

Cypress.Commands.add('nodeAttr', (typeName: string, attr: string) => {
  return cy.getEditor().then((editor) => {
    let value: string | null = null
    editor.state.doc.descendants((node: PMNode) => {
      if (value !== null) return
      if (node.type.name === typeName) value = node.attrs[attr] ?? null
    })
    // cy.wrap keeps the yielded subject `string | null` (a bare null return passes the editor through).
    return cy.wrap<string | null>(value)
  })
})

Cypress.Commands.add(
  'expectToolbarFollowsAnchor',
  (toolbarSelector: string, anchorSelector: string, tolerancePx = 4) => {
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(SETTLE_MS)
    cy.get(toolbarSelector).then(($toolbar) => {
      const toolbarBefore = $toolbar[0].getBoundingClientRect().top
      cy.get(anchorSelector).then(($anchor) => {
        const anchorBefore = $anchor[0].getBoundingClientRect().top
        cy.window().then((win) => win.scrollBy(0, SCROLL_PX))
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(REPOSITION_WAIT_MS)
        cy.get(toolbarSelector).then(($toolbar2) => {
          cy.get(anchorSelector).then(($anchor2) => {
            const toolbarAfter = $toolbar2[0].getBoundingClientRect().top
            const anchorAfter = $anchor2[0].getBoundingClientRect().top
            const toolbarDelta = toolbarBefore - toolbarAfter
            const anchorDelta = anchorBefore - anchorAfter
            expect(
              toolbarDelta,
              `toolbar Δtop (${toolbarDelta.toFixed(1)}) should match anchor Δtop (${anchorDelta.toFixed(1)})`
            ).to.be.closeTo(anchorDelta, tolerancePx)
          })
        })
      })
    })
  }
)

export {}
