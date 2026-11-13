/**
 * What each mark opens in four configs, for a click, Mod-k, each opener and the create dry run (#775).
 * `Hyperlink` must keep the 2.3.0 cells; `HyperlinkBase` drops only the prebuilt fallback.
 */
import '../../link-icons/__tests__/setupDom'

import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'bun:test'

import { getDefaultController, resetDefaultController } from '../../floating-popover'
import { Hyperlink, HyperlinkBase } from '../../hyperlink'
import { Doc, Paragraph, Text } from '../../link-icons/__tests__/minimalSchema'
import {
  createHyperlinkPopover,
  editHyperlinkPopover,
  previewHyperlinkPopover
} from '../../popovers'
import { buildPreviewOptionsFromAnchor } from '../buildPreviewOptionsFromAnchor'
import { openCreateHyperlink } from '../openCreateHyperlink'
import { openEditHyperlink } from '../openEditHyperlink'
import { openPreviewHyperlink } from '../openPreviewHyperlink'

type Mark = typeof Hyperlink

// Positions in CONTENT: "Try " is 1-5, the link "this link" is 5-14.
const CONTENT = '<p>Try <a href="https://example.com">this link</a>.</p>'
const OUTSIDE = 2
const INSIDE = 7

const CONFIGS: Record<string, (mark: Mark) => Mark> = {
  'no options': (mark) => mark,
  'configure({})': (mark) => mark.configure({}),
  'null slots': (mark) =>
    mark.configure({
      popovers: { previewHyperlink: null, editHyperlink: null, createHyperlink: null }
    }),
  Quickstart: (mark) =>
    mark.configure({
      popovers: {
        previewHyperlink: previewHyperlinkPopover,
        editHyperlink: editHyperlinkPopover,
        createHyperlink: createHyperlinkPopover
      }
    })
}

const editors: Editor[] = []
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
  document.body.replaceChildren()
  resetDefaultController()
})

function makeEditor(mark: Mark): Editor {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    content: CONTENT,
    extensions: [Doc, Paragraph, Text, mark]
  })
  editors.push(editor)
  return editor
}

const opened = () => {
  const state = getDefaultController().getState()
  return state.kind === 'idle' ? 'idle' : state.popoverKind
}

// A real keydown, so the keymap and ProseMirror's own handling both run.
function pressModK(editor: Editor, pos: number): string {
  editor.commands.setTextSelection(pos)
  const isMac = /Mac|iP(hone|[oa]d)/.test(navigator.platform)
  const event = new KeyboardEvent('keydown', {
    key: 'k',
    code: 'KeyK',
    ctrlKey: !isMac,
    metaKey: isMac,
    bubbles: true,
    cancelable: true
  })
  editor.view.dom.dispatchEvent(event)
  return `${opened()} ${event.defaultPrevented ? 'handled' : 'unhandled'}`
}

const anchor = (editor: Editor) => editor.view.dom.querySelector('a')!

const ACTIONS: Record<string, (editor: Editor) => string> = {
  'click a link': (editor) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 })
    anchor(editor).dispatchEvent(event)
    return opened()
  },
  'Mod-k outside a link': (editor) => pressModK(editor, OUTSIDE),
  'Mod-k inside a link': (editor) => pressModK(editor, INSIDE),
  openPreviewHyperlink: (editor) => {
    const result = openPreviewHyperlink(
      buildPreviewOptionsFromAnchor({ editor, link: anchor(editor) })
    )
    return `${opened()} ${result}`
  },
  openEditHyperlink: (editor) => {
    openEditHyperlink({ editor, link: anchor(editor) })
    return opened()
  },
  openCreateHyperlink: (editor) => {
    editor.commands.setTextSelection(OUTSIDE)
    const result = openCreateHyperlink(editor)
    return `${opened()} ${result}`
  },
  'can().openCreateHyperlinkPopover': (editor) => {
    editor.commands.setTextSelection(OUTSIDE)
    const result = editor.can().openCreateHyperlinkPopover()
    return `${opened()} ${result}`
  }
}

// Floating UI positions after a tick, so close and let it settle before the editor goes.
async function matrix(mark: Mark): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {}
  for (const [config, apply] of Object.entries(CONFIGS)) {
    out[config] = {}
    for (const [action, run] of Object.entries(ACTIONS)) {
      out[config][action] = run(makeEditor(apply(mark)))
      getDefaultController().close()
      await new Promise((resolve) => setTimeout(resolve, 0))
      for (const editor of editors.splice(0)) editor.destroy()
    }
  }
  return out
}

// 2.3.0: the openers fall back to the prebuilt forms; the click and Mod-k inside a link read the slot only.
const FALLBACK = {
  'click a link': 'idle',
  'Mod-k outside a link': 'create handled',
  'Mod-k inside a link': 'idle handled',
  openPreviewHyperlink: 'preview true',
  openEditHyperlink: 'edit',
  openCreateHyperlink: 'create true',
  'can().openCreateHyperlinkPopover': 'idle true'
}
// HyperlinkBase has no prebuilt forms, so an empty slot opens nothing and Mod-k outside a link falls through.
const NOTHING = {
  'click a link': 'idle',
  'Mod-k outside a link': 'idle unhandled',
  'Mod-k inside a link': 'idle handled',
  openPreviewHyperlink: 'idle false',
  openEditHyperlink: 'idle',
  openCreateHyperlink: 'idle false',
  'can().openCreateHyperlinkPopover': 'idle false'
}
const EVERYTHING = {
  'click a link': 'preview',
  'Mod-k outside a link': 'create handled',
  'Mod-k inside a link': 'preview handled',
  openPreviewHyperlink: 'preview true',
  openEditHyperlink: 'edit',
  openCreateHyperlink: 'create true',
  'can().openCreateHyperlinkPopover': 'idle true'
}

describe('popover fallback matrix', () => {
  it('Hyperlink keeps the 2.3.0 behaviour in all 28 cells', async () => {
    expect(await matrix(Hyperlink)).toEqual({
      'no options': FALLBACK,
      'configure({})': FALLBACK,
      'null slots': FALLBACK,
      Quickstart: EVERYTHING
    })
  })

  it('HyperlinkBase opens nothing with empty slots, and everything in the Quickstart', async () => {
    expect(await matrix(HyperlinkBase)).toEqual({
      'no options': NOTHING,
      'configure({})': NOTHING,
      'null slots': NOTHING,
      Quickstart: EVERYTHING
    })
  })
})
