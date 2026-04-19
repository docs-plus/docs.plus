/**
 * Clean-room playground for the Cypress E2E suite. Mounts a vanilla Tiptap
 * editor against the extension's shipped `dist/`, exactly like an npm
 * consumer would. `?popover=custom` swaps the prebuilt popovers for minimal
 * BYO factories that record their calls on `window._byo` for
 * `custom-popover.cy.ts`.
 */

import '@docs.plus/extension-hyperlink/styles.css'

import * as HyperlinkModule from '@docs.plus/extension-hyperlink'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

const { Hyperlink, createHyperlinkPopover, previewHyperlinkPopover, hideCurrentToolbar } =
  HyperlinkModule

const element = document.querySelector<HTMLElement>('#editor')
if (!element) throw new Error('#editor mount point missing')

const useCustomPopovers = new URLSearchParams(window.location.search).get('popover') === 'custom'

// A stable function reference we pass as `Hyperlink.configure({ validate })`
// so `custom-popover.cy.ts` can assert the factory receives the *same*
// function the consumer configured, not just "a function" or `undefined`.
// Permissive on purpose — it must accept `https://example.com` so the
// preview-flow test fixture (`<a href="https://example.com">`) still
// triggers the factory.
const configuredValidate = (url: string): boolean => /^https?:/i.test(url)

interface ByoState {
  createCalls: HyperlinkModule.CreateHyperlinkOptions[]
  previewCalls: HyperlinkModule.PreviewHyperlinkOptions[]
  configuredValidate: typeof configuredValidate
}

const byoState: ByoState = {
  createCalls: [],
  previewCalls: [],
  configuredValidate
}

function byoCreateHyperlink(options: HyperlinkModule.CreateHyperlinkOptions): HTMLElement {
  byoState.createCalls.push(options)

  const root = document.createElement('div')
  root.className = 'byo-create-popover'
  root.dataset.extensionName = options.extensionName

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'byo-close'
  close.textContent = 'Close'
  close.addEventListener('click', () => hideCurrentToolbar())

  root.append(close)
  return root
}

// Mirrors the `previewHyperlink` example in README.md so the spec can
// verify the snippet as-written: anchor from `attrs.href` + Remove button
// wiring `hideCurrentToolbar()` and `editor.unsetHyperlink()`.
function byoPreviewHyperlink(options: HyperlinkModule.PreviewHyperlinkOptions): HTMLElement {
  byoState.previewCalls.push(options)
  const { editor, attrs } = options

  const root = document.createElement('div')
  root.className = 'byo-preview-popover'
  root.dataset.href = attrs.href ?? ''

  const link = document.createElement('a')
  link.className = 'byo-preview-href'
  link.href = attrs.href ?? ''
  link.textContent = attrs.href ?? ''
  link.target = '_blank'
  link.rel = 'noreferrer'

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'byo-remove'
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    hideCurrentToolbar()
    editor.chain().focus().unsetHyperlink().run()
  })

  root.append(link, remove)
  return root
}

const editor = new Editor({
  element,
  extensions: [
    StarterKit.configure({ link: false }),
    Hyperlink.configure({
      autolink: true,
      openOnClick: true,
      linkOnPaste: true,
      protocols: ['ftp', 'mailto'],
      // `validate` is only wired on the BYO branch so the prebuilt specs
      // keep their exact prior behaviour (they don't pass a validator).
      ...(useCustomPopovers ? { validate: configuredValidate } : {}),
      popovers: useCustomPopovers
        ? { previewHyperlink: byoPreviewHyperlink, createHyperlink: byoCreateHyperlink }
        : { previewHyperlink: previewHyperlinkPopover, createHyperlink: createHyperlinkPopover }
    })
  ],
  content: '<p>Select text and press <strong>Mod+K</strong> to create a link.</p>'
})

declare global {
  interface Window {
    _editor: Editor
    _hyperlink: typeof HyperlinkModule
    _byo?: ByoState
  }
}

window._editor = editor
window._hyperlink = HyperlinkModule
if (useCustomPopovers) window._byo = byoState
