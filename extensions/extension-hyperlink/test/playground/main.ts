import '@docs.plus/extension-hyperlink/styles.css'
import '@docs.plus/extension-hyperlink/hovercard.css'

import * as HyperlinkModule from '@docs.plus/extension-hyperlink'
import { setupPlayground } from '@docs.plus/playground/setup'
import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
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
      '--hl-shadow': '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08)'
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
      '--hl-shadow': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)'
    }
  }
})

const params = new URLSearchParams(window.location.search)
const useCustomPopovers = params.get('popover') === 'custom'
// `popover=none` leaves both slots null (the extension default) so specs can
// reach clickHandler's no-popover fallback branch, unreachable otherwise.
const noPopovers = params.get('popover') === 'none'
const readOnly = params.get('readonly') === 'on'
const blockAutoLink = params.get('shouldAutoLink') === 'block'
const enableClickSelection = params.get('clickSelection') === 'on'
const exitable = params.get('exitable') === 'on'
// `navigate=spy` records each host `navigate` call on `window._navigateCalls` and opens nothing.
const navigateSpy = params.get('navigate') === 'spy'
// `gate=strict` adds a host isAllowedUri that refuses blocked.example on top of the safety floor.
const strictGate = params.get('gate') === 'strict'
if (navigateSpy) window._navigateCalls = []
// `icons=element` draws a coloured box before every http(s) link, with no network.
// `icons=throw` also throws for throw.example hrefs, for the console error spec.
// `icons=map|fetcher|both` use the real helpers on the PNGs in ./icons; `tile=on` tiles fetched icons.
const icons = params.get('icons')
// One token per page load, so the HTTP cache cannot hide requests across Cypress tests.
const RUN = Date.now()
const media = (file: string): string => `/readme-media/${file}?run=${RUN}`

const boxIcon = ({ href }: HyperlinkModule.LinkIconContext): HTMLElement | null => {
  window._iconCalls = (window._iconCalls ?? 0) + 1
  if (icons === 'throw' && href.includes('throw.example')) throw new Error('icon failed')
  if (!/^https?:/i.test(href)) return null
  const box = document.createElement('span')
  box.style.background = '#2563eb'
  box.style.borderRadius = '2px'
  return box
}
// Built once: each helper keeps its own failed-URL set.
const mapIcon = HyperlinkModule.linkIconMap({
  'foreman.example': media('map.png'),
  'map.example': media('map.png'),
  'pair.example': { light: media('light.png'), dark: media('dark.png') },
  'factory.example': () =>
    Object.assign(document.createElement('span'), { style: 'background:#16a34a' })
})
const fetchIcon = HyperlinkModule.linkIconFetcher({
  src: (origin) => media(`${new URL(origin).hostname}.png`),
  tile: params.get('tile') === 'on'
})

const linkIcon: HyperlinkModule.HyperlinkOptions['linkIcon'] =
  icons === 'element' || icons === 'throw'
    ? boxIcon
    : icons === 'map'
      ? mapIcon
      : icons === 'fetcher'
        ? fetchIcon
        : icons === 'both'
          ? (ctx) => mapIcon(ctx) ?? fetchIcon(ctx)
          : undefined
if (linkIcon) window._iconCalls = 0

// `hovercard=on` shows the built-in card; `hovercard=custom` draws `renderCard` below. The stub
// counts calls on `window._hovercard` and answers after `delayMs` on the page clock, so `cy.tick`
// drives it. Each spec serves pictures with `cy.intercept`; with none they 404 (no picture).
const hovercardMode = params.get('hovercard')
const picture = (name: string): string => `/readme-media/hovercard/${name}.svg?run=${RUN}`
const HOVERCARD_PAGES: Record<string, HyperlinkModule.HovercardData> = {
  'https://wide.example/': {
    title: 'Wide page',
    description: 'A page with a wide share picture.',
    image: { url: picture('wide'), width: 1200, height: 630 }
  },
  'https://slow.example/': { title: 'Slow page', image: { url: picture('slow') } },
  'https://xss.example/': { title: '<img src=x onerror=alert(1)>' },
  'https://notitle.example/': { description: 'A page with no title.' },
  // The README gallery shot. `readme-gallery.cy.ts` serves its picture.
  'https://docs.plus/': {
    title: 'docs.plus',
    description: 'Documents with a chat for every heading.',
    image: { url: picture('gallery'), width: 1200, height: 630 }
  }
}

// The custom card that `docs/hovercard.md` points at: plain DOM, one element per state.
function renderCard(ctx: HyperlinkModule.HovercardRenderContext): HyperlinkModule.HovercardView {
  const root = document.createElement('div')
  root.className = 'demo-card'
  root.dataset.state = ctx.state
  root.style.padding = '12px'
  if (ctx.state !== 'data') {
    root.textContent = ctx.state === 'loading' ? 'Loading…' : 'Nothing to show for this link.'
    return { element: root }
  }

  // Card controls stay out of the Tab order, and a press keeps the caret in the editor.
  const button = (text: string, onClick: (e: MouseEvent) => void): HTMLButtonElement => {
    const el = document.createElement('button')
    el.type = 'button'
    el.tabIndex = -1
    el.textContent = text
    el.addEventListener('mousedown', (e) => e.preventDefault())
    el.addEventListener('click', onClick)
    return el
  }
  const title = document.createElement('strong')
  title.textContent = ctx.data.title ?? ctx.href
  const open = button('Open', (e) => ctx.open(HyperlinkModule.hasMod(e)))
  const copy = button('Copy', () => {
    void ctx.copy().then((ok) => {
      copy.textContent = ok ? 'Copied' : 'Copy failed'
    })
  })
  root.append(title, document.createElement('br'), open, copy)
  return { element: root }
}

type HovercardStub = {
  calls: string[]
  delayMs: number
  /** One entry per view `renderCard` drew, with how often the engine destroyed it. */
  views: Array<{ href: string; state: string; destroyed: number }>
  /** For each destroy, whether the view's element was still in the DOM. */
  attachedAtDestroy: boolean[]
}
const hovercardState: HovercardStub = { calls: [], delayMs: 100, views: [], attachedAtDestroy: [] }

// Test hooks around the example: `builtin.example` keeps the built-in card, `throw.example` throws.
const trackedRender: HyperlinkModule.HovercardOptions['render'] = (ctx) => {
  if (ctx.href.includes('builtin.example')) return null
  if (ctx.href.includes('throw.example')) throw new Error('render failed')
  const view = renderCard(ctx)
  const entry = { href: ctx.href, state: ctx.state, destroyed: 0 }
  hovercardState.views.push(entry)
  return {
    element: view.element,
    destroy: () => {
      entry.destroyed++
      hovercardState.attachedAtDestroy.push(view.element.isConnected)
    }
  }
}

const hovercard: HyperlinkModule.HovercardOptions | undefined =
  hovercardMode === 'on' || hovercardMode === 'custom'
    ? {
        fetchMetadata: ({ href }) => {
          hovercardState.calls.push(href)
          const data = HOVERCARD_PAGES[href] ?? { title: href }
          // `window.` reads the timer at call time, so the clock that `cy.clock` installs drives it.
          return new Promise((resolve) =>
            window.setTimeout(() => resolve(data), hovercardState.delayMs)
          )
        },
        siteIcon: () =>
          Object.assign(document.createElement('span'), { style: 'background:#16a34a' }),
        shouldShow: ({ href }) => !href.includes('noshow.example'),
        ...(hovercardMode === 'custom' && { render: trackedRender })
      }
    : undefined
if (hovercard) window._hovercard = hovercardState

// `pasteTitle=on` answers "Example Domain" after `delayMs` on the page clock, so `cy.tick` drives
// it. `slow` answers after the 4 s deadline, `throw` throws at once and `null` keeps the URL.
// Every mode refuses nofetch.example through `shouldFetch`. Each call keeps its signal.
const pasteTitleMode = params.get('pasteTitle')
type PasteTitleStub = {
  calls: Array<{ href: string; signal: AbortSignal }>
  delayMs: number
}
const pasteTitleState: PasteTitleStub = {
  calls: [],
  delayMs: pasteTitleMode === 'slow' ? 6000 : 100
}
const pasteTitle: HyperlinkModule.PasteTitleOptions | undefined = pasteTitleMode
  ? {
      fetchTitle: ({ href, signal }) => {
        pasteTitleState.calls.push({ href, signal })
        if (pasteTitleMode === 'throw') throw new Error('fetchTitle failed')
        const title = pasteTitleMode === 'null' ? null : 'Example Domain'
        return new Promise((resolve) =>
          window.setTimeout(() => resolve(title), pasteTitleState.delayMs)
        )
      },
      shouldFetch: ({ href }) => !href.includes('nofetch.example')
    }
  : undefined
if (pasteTitle) window._pasteTitle = pasteTitleState

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

function labeledPreviewHyperlink(options: HyperlinkModule.PreviewHyperlinkOptions): HTMLElement {
  const root = previewHyperlinkPopover(options)
  root.style.flexWrap = 'wrap'
  root.style.maxWidth = 'calc(100vw - 32px)'
  for (const button of root.querySelectorAll('button')) {
    const label = document.createElement('span')
    label.textContent = button.getAttribute('aria-label')
    button.append(label)
    button.style.width = 'auto'
    button.style.padding = '0 10px'
  }
  return root
}

const popovers = useCustomPopovers
  ? { previewHyperlink: byoPreviewHyperlink, createHyperlink: byoCreateHyperlink }
  : noPopovers
    ? { previewHyperlink: null, createHyperlink: null }
    : {
        previewHyperlink:
          params.get('popover') === 'labels' ? labeledPreviewHyperlink : previewHyperlinkPopover,
        createHyperlink: createHyperlinkPopover
      }

const editor = new Editor({
  element,
  extensions: [
    StarterKit.configure({ link: false }),
    Markdown.configure(),
    Hyperlink.configure({
      autolink: true,
      openOnClick: true,
      linkOnPaste: true,
      protocols: ['ftp', 'mailto'],
      ...(useCustomPopovers && { validate: configuredValidate }),
      ...(blockAutoLink && { shouldAutoLink: () => false }),
      ...(enableClickSelection && { enableClickSelection: true }),
      ...(exitable && { exitable: true }),
      ...(linkIcon && { linkIcon }),
      ...(hovercard && { hovercard }),
      ...(pasteTitle && { pasteTitle }),
      ...(strictGate && {
        isAllowedUri: (uri: string, { defaultValidate }: HyperlinkModule.IsAllowedUriContext) =>
          defaultValidate(uri) && !uri.includes('blocked.example')
      }),
      ...(navigateSpy && {
        navigate: (href: string, { newTab }: { newTab: boolean }) => {
          window._navigateCalls?.push({ href, newTab })
        }
      }),
      popovers
    })
  ],
  content: '<p>Select text and press <strong>Mod+K</strong> to create a link.</p>'
})

// `readonly=on` mimics a published read-only doc (nav-guards.cy.ts fallback spec).
if (readOnly) editor.setEditable(false)

declare global {
  interface Window {
    _editor: Editor
    _hyperlink: typeof HyperlinkModule
    _byo?: ByoState
    _iconCalls?: number
    _navigateCalls?: Array<{ href: string; newTab: boolean }>
    _hovercard?: HovercardStub
    _pasteTitle?: PasteTitleStub
    _getMarkdown?: () => string
    _parseMarkdown?: (md: string) => Record<string, unknown> | undefined
  }
}

window._editor = editor
window._hyperlink = HyperlinkModule
window._getMarkdown = () => editor.getMarkdown()
window._parseMarkdown = (md: string) => editor.markdown?.parse(md)
if (useCustomPopovers) window._byo = byoState
