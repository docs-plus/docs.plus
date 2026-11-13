/**
 * Timed user actions, shared by the jsdom run and the browser page. Each run builds a fresh editor,
 * times one action, and returns the editor with `ms` set. Stress sizes match the 2026-11-12 review;
 * common sizes (25 blocks, 30 lines) match a new pad, as the bench plan sets them.
 */
import type { ChainedCommands, Editor } from '@tiptap/core'

export type Env = {
  Editor: typeof Editor
  StarterKit: any
  win: Window & typeof globalThis
  stage: HTMLElement
}
export type HyperlinkModule = { Hyperlink: any }
export type Timed = { editor: Editor; ms: number }
export type Workload = { unit: 'ms' | 'µs/key'; run: (env: Env, mod: HyperlinkModule) => Timed }

const para = (i: number, html: boolean) => {
  const a = `https://example${i}.com/path/to/page?q=${i}`
  const b = `github.com/org/repo${i}`
  return html
    ? `<p>Paragraph ${i} has some words and <a href="${a}">${a}</a> then more text and <a href="https://${b}">${b}</a> end.</p>`
    : `Paragraph ${i} has some words and ${a} then more text and ${b} end.`
}
const html = (n: number) => Array.from({ length: n }, (_, i) => para(i, true)).join('')
const text = (n: number) => Array.from({ length: n }, (_, i) => para(i, false)).join('\n')
const HTML_2000 = html(2000)
const HTML_500 = html(500)
const HTML_25 = html(25)
const TEXT_2000 = text(2000)
const TEXT_30 = text(30)
const TYPED = 'hello world see example.com now and type more words here mail me@x.io ok '
  .repeat(14)
  .slice(0, 1000)
const WORDS_250K = 'word '.repeat(50000)

function make(env: Env, mod: HyperlinkModule, content: string): Editor {
  const element = env.win.document.createElement('div')
  env.stage.append(element)
  return new env.Editor({
    element,
    extensions: [env.StarterKit.configure({ link: false }), mod.Hyperlink],
    content
  })
}

function typeChars(editor: Editor, text: string) {
  const view = editor.view
  for (const ch of text) {
    const { from, to } = view.state.selection
    const insert = () => view.state.tr.insertText(ch, from, to)
    if (!view.someProp('handleTextInput', (f) => f(view, from, to, ch, insert)))
      view.dispatch(insert())
  }
}

function paste(env: Env, editor: Editor, text: string) {
  const event = new env.win.Event('paste', { bubbles: true, cancelable: true })
  const clipboardData = {
    getData: (k: string) => (k === 'text/plain' ? text : ''),
    types: ['text/plain']
  }
  Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  editor.view.dom.dispatchEvent(event)
}

// StarterKit's Bold command. The bench loads StarterKit at run time, not through its types.
const bold = (chain: ChainedCommands) =>
  (chain as unknown as { toggleBold: () => ChainedCommands }).toggleBold()

function timed(editor: Editor, action: () => void): Timed {
  const t = performance.now()
  action()
  return { editor, ms: performance.now() - t }
}

const pasteText = (content: string): Workload => ({
  unit: 'ms',
  run: (env, mod) => {
    const e = make(env, mod, '<p></p>')
    e.commands.focus('end')
    return timed(e, () => paste(env, e, content))
  }
})
const boldAll = (content: string): Workload => ({
  unit: 'ms',
  run: (env, mod) => {
    const e = make(env, mod, content)
    return timed(e, () => bold(e.chain().selectAll()).run())
  }
})
const typeEnd = (content: string): Workload => ({
  unit: 'µs/key',
  run: (env, mod) => {
    const e = make(env, mod, content)
    e.commands.setTextSelection(e.state.doc.content.size - 1)
    const r = timed(e, () => typeChars(e, TYPED))
    return { editor: e, ms: (r.ms * 1000) / TYPED.length }
  }
})
const mount = (content: string): Workload => ({
  unit: 'ms',
  run: (env, mod) => {
    const t = performance.now()
    const e = make(env, mod, content)
    return { editor: e, ms: performance.now() - t }
  }
})

export const WORKLOADS: Record<string, Workload> = {
  pasteText30: pasteText(TEXT_30),
  pasteText2000: pasteText(TEXT_2000),
  boldAll25: boldAll(HTML_25),
  boldAll2000: boldAll(HTML_2000),
  typeEnd25: typeEnd(HTML_25),
  typeEnd2000: typeEnd(HTML_2000),
  pasteOverSelection250k: {
    unit: 'ms',
    run: (env, mod) => {
      const e = make(env, mod, '<p>select me please</p>')
      e.commands.setTextSelection({ from: 1, to: 7 })
      return timed(e, () => paste(env, e, WORDS_250K))
    }
  },
  boldPartOfLink: {
    unit: 'ms',
    run: (env, mod) => {
      const e = make(env, mod, '<p>a <a href="https://example.com">example.com</a> b</p>')
      return timed(e, () => bold(e.chain().setTextSelection({ from: 5, to: 9 })).run())
    }
  },
  mount50Links: mount(HTML_25),
  mount1000Links: mount(HTML_500)
}
