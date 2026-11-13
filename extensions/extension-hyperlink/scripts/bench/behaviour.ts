/**
 * Behaviour matrix per variant. "Pass" is what a user expects, which is also what upstream
 * `@tiptap/extension-link` does. Cases that fail today are the "before" for an open issue.
 */
import type { Editor } from '@tiptap/core'

import type { Env, HyperlinkModule } from './workloads'

type Case = {
  group: string
  name: string
  content: string
  act: (e: Editor) => unknown
  want: string
}

const ONE = '<p><a href="https://example.com">example.com</a></p>'
const TWO =
  '<p><a href="https://example.com">example.com</a> and <a href="https://foo.org">foo.org</a></p>'
const SPLIT = '<p><a href="https://example.com"><strong>exam</strong>ple.com</a></p>'
const CUSTOM_HREF = '<p><a href="https://other.example/x">example.com</a> after</p>'
const L11 = 'LLLLLLLLLLL'

// StarterKit's mark and history commands. The bench loads StarterKit at run time, not through its types.
type KitCommand =
  | 'toggleBold'
  | 'toggleItalic'
  | 'toggleStrike'
  | 'toggleUnderline'
  | 'toggleCode'
  | 'undo'
  | 'redo'
const kit = (e: Editor) => e.commands as unknown as Record<KitCommand, () => boolean>
const select = (e: Editor, from: number, to: number) => e.commands.setTextSelection({ from, to })
function typeAt(e: Editor, pos: number, text: string) {
  const view = e.view
  e.commands.setTextSelection(pos)
  for (const ch of text) {
    const { from, to } = view.state.selection
    const insert = () => view.state.tr.insertText(ch, from, to)
    if (!view.someProp('handleTextInput', (f) => f(view, from, to, ch, insert)))
      view.dispatch(insert())
  }
}
// One character per text character: L when linked, '.' when not. '¶' starts each later textblock.
// Custom-href cases print the hrefs.
const coverage = (e: Editor) => {
  let s = ''
  let blocks = 0
  e.state.doc.descendants((n) => {
    if (n.isTextblock && blocks++) s += '¶'
    if (n.isText)
      for (let i = 0; i < n.text!.length; i++)
        s += n.marks.some((m) => m.type.name === 'hyperlink') ? 'L' : '.'
  })
  return s
}
// Built like prosemirror-view's keyEvent(), in the editor's own window.
function pressEnter(e: Editor, pos: number) {
  e.commands.setTextSelection(pos)
  const ev = e.view.dom.ownerDocument.createEvent('Event') as KeyboardEvent & { keyCode: number }
  ev.initEvent('keydown', true, true)
  Object.assign(ev, { keyCode: 13, key: 'Enter', code: 'Enter' })
  return e.view.someProp('handleKeyDown', (f) => f(e.view, ev))
}
const hrefs = (e: Editor) => {
  const seen = new Set<string>()
  e.state.doc.descendants((n) =>
    n.marks.forEach((m) => m.type.name === 'hyperlink' && seen.add(m.attrs.href))
  )
  return [...seen].join(',')
}

const CASES: Case[] = [
  ...(
    [
      [1, 5],
      [5, 9],
      [3, 7],
      [8, 12]
    ] as const
  ).map(([f, t]) => ({
    group: 'strip',
    name: `bold ${f}-${t}`,
    content: ONE,
    act: (e: Editor) => select(e, f, t) && kit(e).toggleBold(),
    want: L11
  })),
  {
    group: 'strip',
    name: 'italic 5-9',
    content: ONE,
    act: (e) => select(e, 5, 9) && kit(e).toggleItalic(),
    want: L11
  },
  {
    group: 'strip',
    name: 'strike 5-9',
    content: ONE,
    act: (e) => select(e, 5, 9) && kit(e).toggleStrike(),
    want: L11
  },
  {
    group: 'strip',
    name: 'underline 5-9',
    content: ONE,
    act: (e) => select(e, 5, 9) && kit(e).toggleUnderline(),
    want: L11
  },
  {
    group: 'strip',
    name: 'code 5-9',
    content: ONE,
    act: (e) => select(e, 5, 9) && kit(e).toggleCode(),
    want: 'LLLL....LLL'
  },
  {
    group: 'strip',
    name: 'two links, bold 5-21',
    content: TWO,
    act: (e) => select(e, 5, 21) && kit(e).toggleBold(),
    want: 'LLLLLLLLLLL.....LLLLLLL'
  },
  {
    group: 'strip',
    name: 'type inside a split link',
    content: SPLIT,
    act: (e) => typeAt(e, 8, 'x'),
    want: 'LLLLLLLLLLLL'
  },
  {
    group: 'undo',
    name: 'undo after bold 5-9',
    content: ONE,
    act: (e) => select(e, 5, 9) && kit(e).toggleBold() && kit(e).undo(),
    want: L11
  },
  {
    group: 'undo',
    name: 'redo after undo',
    content: ONE,
    act: (e) => select(e, 5, 9) && kit(e).toggleBold() && kit(e).undo() && kit(e).redo(),
    want: L11
  },
  {
    group: 'keep',
    name: 'delete ".com" unlinks',
    content: ONE,
    act: (e) => select(e, 8, 12) && e.commands.deleteSelection(),
    want: '.......'
  },
  {
    group: 'keep',
    name: 'space inside a link keeps it',
    content: ONE,
    act: (e) => typeAt(e, 5, ' '),
    want: 'LLLLLLLLLLLL'
  },
  {
    group: 'keep',
    name: 'custom label stays linked',
    content: '<p><a href="https://example.com">click here</a></p>',
    act: (e) => select(e, 3, 7) && kit(e).toggleBold(),
    want: 'LLLLLLLLLL'
  },
  {
    group: 'keep',
    name: 'autolink on space',
    content: '<p>see example.com</p>',
    act: (e) => typeAt(e, 16, ' '),
    want: '....LLLLLLLLLLL.'
  },
  {
    group: 'enter',
    name: 'enter inside a link',
    content: ONE,
    act: (e) => pressEnter(e, 5),
    want: 'LLLL¶LLLLLLL'
  },
  {
    group: 'href',
    name: 'custom href after a space',
    content: CUSTOM_HREF,
    act: (e) => typeAt(e, 12, ' '),
    want: 'href:https://other.example/x'
  },
  {
    group: 'href',
    name: 'custom href after bold 1-13',
    content: CUSTOM_HREF,
    act: (e) => select(e, 1, 13) && kit(e).toggleBold(),
    want: 'href:https://other.example/x'
  }
]

export type Behaviour = {
  pass: number
  total: number
  groups: Record<string, string>
  failed: string[]
}

export function runBehaviour(env: Env, mod: HyperlinkModule): Behaviour {
  const failed: string[] = []
  const groups: Record<string, [number, number]> = {}
  for (const c of CASES) {
    const element = env.win.document.createElement('div')
    env.stage.append(element)
    const e = new env.Editor({
      element,
      extensions: [env.StarterKit.configure({ link: false }), mod.Hyperlink],
      content: c.content
    })
    c.act(e)
    const got = c.want.startsWith('href:') ? `href:${hrefs(e)}` : coverage(e)
    e.destroy()
    element.remove()
    const g = (groups[c.group] ??= [0, 0])
    g[1]++
    if (got === c.want) g[0]++
    else failed.push(`${c.group}: ${c.name}`)
  }
  return {
    pass: CASES.length - failed.length,
    total: CASES.length,
    groups: Object.fromEntries(Object.entries(groups).map(([k, [p, t]]) => [k, `${p}/${t}`])),
    failed
  }
}
