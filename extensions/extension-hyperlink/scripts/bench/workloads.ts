/**
 * Timed user actions, shared by the jsdom run and the browser page. Each run builds a fresh editor,
 * times one action, and returns the editor with `ms` set. Sizes match the 2026-11-12 review.
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
const HTML_2000 = Array.from({ length: 2000 }, (_, i) => para(i, true)).join('')
const HTML_500 = Array.from({ length: 500 }, (_, i) => para(i, true)).join('')
const TEXT_2000 = Array.from({ length: 2000 }, (_, i) => para(i, false)).join('\n')
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

export const WORKLOADS: Record<string, Workload> = {
  pasteText2000: {
    unit: 'ms',
    run: (env, mod) => {
      const e = make(env, mod, '<p></p>')
      e.commands.focus('end')
      return timed(e, () => paste(env, e, TEXT_2000))
    }
  },
  boldAll2000: {
    unit: 'ms',
    run: (env, mod) => {
      const e = make(env, mod, HTML_2000)
      return timed(e, () => bold(e.chain().selectAll()).run())
    }
  },
  typeEnd2000: {
    unit: 'µs/key',
    run: (env, mod) => {
      const e = make(env, mod, HTML_2000)
      e.commands.setTextSelection(e.state.doc.content.size - 1)
      const r = timed(e, () => typeChars(e, TYPED))
      return { editor: e, ms: (r.ms * 1000) / TYPED.length }
    }
  },
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
  mount1000Links: {
    unit: 'ms',
    run: (env, mod) => {
      const t = performance.now()
      const e = make(env, mod, HTML_500)
      return { editor: e, ms: performance.now() - t }
    }
  }
}
