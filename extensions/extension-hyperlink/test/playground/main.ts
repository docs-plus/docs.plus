/** Cypress clean-room: shipped dist; `?popover=custom` wires BYO popovers on `window._byo`. */

import '@docs.plus/extension-hyperlink/styles.css'

import * as HyperlinkModule from '@docs.plus/extension-hyperlink'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

const { Hyperlink, createHyperlinkPopover, previewHyperlinkPopover, getDefaultController } =
  HyperlinkModule

const element = setupPlayground({
  title: '@docs.plus/extension-hyperlink — clean-room playground',
  github: 'extension-hyperlink',
  tokens: {
    light: {
      '--hl-bg': '#ffffff',
      '--hl-fg': '#111827',
      '--hl-muted': '#6b7280',
      '--hl-border': '#e5e7eb',
      '--hl-hover': '#f3f4f6',
      '--hl-accent': '#2563eb',
      '--hl-accent-fg': '#ffffff',
      '--hl-danger': '#dc2626',
      '--hl-shadow': '0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.08)'
    },
    dark: {
      '--hl-bg': '#1f2937',
      '--hl-fg': '#f3f4f6',
      '--hl-muted': '#9ca3af',
      '--hl-border': '#374151',
      '--hl-hover': '#374151',
      '--hl-accent': '#60a5fa',
      '--hl-accent-fg': '#0b1220',
      '--hl-danger': '#f87171',
      '--hl-shadow': '0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.5)'
    }
  }
})

const params = new URLSearchParams(window.location.search)
const useCustomPopovers = params.get('popover') === 'custom'
const blockAutoLink = params.get('shouldAutoLink') === 'block'
const enableClickSelection = params.get('clickSelection') === 'on'
const exitable = params.get('exitable') === 'on'

// Stable reference for custom-popover.cy.ts; permissive so preview fixture hrefs pass.
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
  close.addEventListener('click', () => getDefaultController().close())

  root.append(close)
  return root
}

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
  link.rel = 'noopener noreferrer'

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'byo-remove'
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    getDefaultController().close()
    editor.chain().focus().unsetHyperlink().run()
  })

  root.append(link, remove)
  return root
}

const popovers = useCustomPopovers
  ? { previewHyperlink: byoPreviewHyperlink, createHyperlink: byoCreateHyperlink }
  : { previewHyperlink: previewHyperlinkPopover, createHyperlink: createHyperlinkPopover }

const editor = new Editor({
  element,
  extensions: [
    StarterKit.configure({ link: false }),
    Hyperlink.configure({
      autolink: true,
      openOnClick: true,
      linkOnPaste: true,
      protocols: ['ftp', 'mailto'],
      ...(useCustomPopovers && { validate: configuredValidate }),
      ...(blockAutoLink && { shouldAutoLink: () => false }),
      ...(enableClickSelection && { enableClickSelection: true }),
      ...(exitable && { exitable: true }),
      popovers
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
