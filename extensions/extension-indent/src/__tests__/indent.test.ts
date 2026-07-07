/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it } from '@jest/globals'
import {
  type CommandProps,
  Editor,
  Extension,
  type JSONContent,
  type RawCommands
} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { docPosAtChunkOffset, Indent, indentContextAtPos, lineTextsWithOffsets } from '../indent'

function createEditor(
  content: string | JSONContent,
  indent?: Parameters<typeof Indent.configure>[0]
): Editor {
  return new Editor({
    extensions: [StarterKit, Indent.configure(indent ?? {})],
    content,
    element: document.createElement('div')
  })
}

/** Select from start of first block’s text to end of last (doc order). */
function selectAcrossBlocks(editor: Editor, blocks: Array<{ name: string; text: string }>) {
  const first = blocks[0]
  const last = blocks[blocks.length - 1]
  let from = 0
  let to = 0
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === first.name && node.textContent === first.text) from = pos + 1
    if (node.type.name === last.name && node.textContent === last.text)
      to = pos + 1 + (node.textContent?.length ?? 0)
  })
  editor.commands.setTextSelection({ from, to })
}

describe('@docs.plus/extension-indent', () => {
  const editors: Editor[] = []

  afterEach(() => {
    while (editors.length) {
      editors.pop()?.destroy()
    }
  })

  function track(editor: Editor): Editor {
    editors.push(editor)
    return editor
  }

  it('indentContextAtPos: top-level paragraph has parent doc', () => {
    const ed = track(createEditor('<p>x</p>'))
    const ctx = indentContextAtPos(ed.state.doc, 1)
    expect(ctx).toEqual({ textblockName: 'paragraph', parentName: 'doc' })
  })

  it('indentContextAtPos: paragraph in list has parent listItem', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }]
            }
          ]
        }
      ]
    }
    const ed = track(createEditor(doc))
    let p: number | null = null
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Item') p = pos + 1
    })
    expect(p).not.toBeNull()
    expect(indentContextAtPos(ed.state.doc, p!)).toEqual({
      textblockName: 'paragraph',
      parentName: 'listItem'
    })
  })

  it('inserts indentChars on indent command in paragraph', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }]
    }
    const editor = track(createEditor(doc))
    editor.commands.setTextSelection(1)
    expect(editor.commands.indent()).toBe(true)
    expect(editor.getText()).toMatch(/^\s{2}Hi/)
  })

  it('returns false for indent in heading under default allowlist (doc/blockquote paragraphs only)', () => {
    const editor = track(createEditor('<h2>Title</h2>'))
    editor.commands.setTextSelection(1)
    expect(editor.commands.indent()).toBe(false)
  })

  it('indents heading when allowedIndentContexts includes heading + parent', () => {
    const editor = track(
      createEditor('<h2>Title</h2>', {
        indentChars: '\t',
        allowedIndentContexts: [{ textblock: 'heading', parent: 'doc' }]
      })
    )
    editor.commands.setTextSelection(1)
    expect(editor.commands.indent()).toBe(true)
    expect(editor.getText()).toMatch(/^\tTitle/)
  })

  it('returns false for indent in codeBlock (textblock not paragraph)', () => {
    const ed = track(
      createEditor({
        type: 'doc',
        content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'codehere' }] }]
      })
    )
    let p: number | null = null
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'codeBlock') p = pos + 1
    })
    expect(p).not.toBeNull()
    ed.commands.setTextSelection(p!)
    expect(ed.commands.indent()).toBe(false)
    expect(ed.getText().trimEnd()).toBe('codehere')
  })

  it('returns false for indent in list item with defaults (no listItem context rule)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }]
            }
          ]
        }
      ]
    }
    const editor = track(createEditor(doc, { indentChars: '\t' }))
    let p: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Item') p = pos + 1
    })
    expect(p).not.toBeNull()
    editor.commands.setTextSelection(p!)
    expect(editor.commands.indent()).toBe(false)
    expect(editor.getText()).not.toMatch(/\t/)
  })

  it('indent in list only when paragraph+listItem rule exists; body blocked if doc rule omitted', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }]
            }
          ]
        }
      ]
    }
    const editor = track(
      createEditor(doc, {
        indentChars: '\t',
        allowedIndentContexts: [{ textblock: 'paragraph', parent: 'listItem' }]
      })
    )
    let p: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Item') p = pos + 1
    })
    expect(p).not.toBeNull()
    editor.commands.setTextSelection(p!)
    expect(editor.commands.indent()).toBe(true)
    expect(editor.getText()).toMatch(/\t/)
  })

  it('returns false for body paragraph when contexts are only paragraph+listItem', () => {
    const editor = track(
      createEditor('<p>Body</p>', {
        indentChars: '\t',
        allowedIndentContexts: [{ textblock: 'paragraph', parent: 'listItem' }]
      })
    )
    editor.commands.setTextSelection(1)
    expect(editor.commands.indent()).toBe(false)
    expect(editor.getText()).toBe('Body')
  })

  it('returns false for paragraph in blockquote when contexts are only paragraph+doc', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q' }] }]
        }
      ]
    }
    const ed = track(
      createEditor(doc, { allowedIndentContexts: [{ textblock: 'paragraph', parent: 'doc' }] })
    )
    let p: number | null = null
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Q') p = pos + 1
    })
    expect(p).not.toBeNull()
    ed.commands.setTextSelection(p!)
    expect(ed.commands.indent()).toBe(false)
  })

  it('returns false for body paragraph when contexts are only paragraph+blockquote', () => {
    const editor = track(
      createEditor('<p>Body</p>', {
        indentChars: '\t',
        allowedIndentContexts: [{ textblock: 'paragraph', parent: 'blockquote' }]
      })
    )
    editor.commands.setTextSelection(1)
    expect(editor.commands.indent()).toBe(false)
  })

  it('indents only in blockquote when contexts are only paragraph+blockquote', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q' }] }]
        }
      ]
    }
    const ed = track(
      createEditor(doc, {
        indentChars: '\t',
        allowedIndentContexts: [{ textblock: 'paragraph', parent: 'blockquote' }]
      })
    )
    let p: number | null = null
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Q') p = pos + 1
    })
    expect(p).not.toBeNull()
    ed.commands.setTextSelection(p!)
    expect(ed.commands.indent()).toBe(true)
    expect(ed.getText()).toContain('\t')
  })

  it('returns false everywhere when allowedIndentContexts is empty', () => {
    const ed = track(createEditor('<p>x</p>', { allowedIndentContexts: [] }))
    ed.commands.setTextSelection(1)
    expect(ed.commands.indent()).toBe(false)
  })

  it('indents paragraph in blockquote with default contexts (paragraph under doc or blockquote)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q' }] }]
        }
      ]
    }
    const ed = track(createEditor(doc, { indentChars: '\t' }))
    let p: number | null = null
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Q') p = pos + 1
    })
    expect(p).not.toBeNull()
    ed.commands.setTextSelection(p!)
    expect(ed.commands.indent()).toBe(true)
    expect(ed.getText()).toContain('\t')
    expect(ed.getText()).toContain('Q')
  })

  it('paragraph: literal tab indent when list sink does not apply', () => {
    const editor = track(createEditor('<p>x</p>', { indentChars: '\t' }))
    expect(editor.can().sinkListItem('listItem')).toBe(false)
    editor.commands.setTextSelection(1)
    expect(editor.commands.indent()).toBe(true)
    expect(editor.getText()).toMatch(/^\tx/)
  })

  it('outdent removes leading indentChars on command', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '  Hi' }]
        }
      ]
    }
    const editor = track(createEditor(doc))
    editor.commands.setTextSelection(3)
    expect(editor.commands.outdent()).toBe(true)
    expect(editor.getText()).toBe('Hi')
  })

  it('returns false for outdent when empty selection has nothing to strip', () => {
    const editor = track(createEditor('<p>Hi</p>'))
    editor.commands.setTextSelection(1)
    expect(editor.commands.outdent()).toBe(false)
  })

  it('returns false for indent when multiline selection spans a disallowed textblock (e.g. heading)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'P' }] }
      ]
    }
    const editor = track(createEditor(doc))
    selectAcrossBlocks(editor, [
      { name: 'heading', text: 'H' },
      { name: 'paragraph', text: 'P' }
    ])
    expect(editor.commands.indent()).toBe(false)
    expect(editor.getText()).toContain('H')
    expect(editor.getText()).toContain('P')
  })

  it('returns false for outdent when multiline selection spans a disallowed textblock', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '  H' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '  P' }] }
      ]
    }
    const editor = track(createEditor(doc))
    selectAcrossBlocks(editor, [
      { name: 'heading', text: '  H' },
      { name: 'paragraph', text: '  P' }
    ])
    expect(editor.commands.outdent()).toBe(false)
  })

  /** Real keydown through the view's keymap pipeline, like a browser Tab press. */
  function pressTab(editor: Editor, shiftKey = false): boolean {
    const event = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', shiftKey })
    return editor.view.someProp('handleKeyDown', (f) => f(editor.view, event)) ?? false
  }

  /** Table-style fake: records can()-probe vs dispatched runs of its cell-nav commands. */
  function createCellNavEditor(runs: string[]): Editor {
    const record =
      (name: string) =>
      () =>
      ({ dispatch }: CommandProps) => {
        runs.push(`${name}:${dispatch ? 'real' : 'dry'}`)
        return true
      }
    const FakeCellNav = Extension.create({
      name: 'fakeCellNav',
      addCommands() {
        return {
          goToNextCell: record('next'),
          goToPreviousCell: record('prev')
        } as unknown as Partial<RawCommands>
      }
    })
    return track(
      new Editor({
        extensions: [StarterKit, FakeCellNav, Indent],
        content: '<p>A</p>',
        element: document.createElement('div')
      })
    )
  }

  it('delegates Tab to goToNextCell via editor.can() instead of inserting indent chars', () => {
    const runs: string[] = []
    const editor = createCellNavEditor(runs)
    editor.commands.setTextSelection(1)
    expect(pressTab(editor)).toBe(true)
    expect(runs).toEqual(['next:dry', 'next:real'])
    expect(editor.getText()).toBe('A')
  })

  it('delegates Shift-Tab to goToPreviousCell via editor.can() before literal outdent', () => {
    const runs: string[] = []
    const editor = createCellNavEditor(runs)
    editor.commands.setTextSelection(1)
    expect(pressTab(editor, true)).toBe(true)
    expect(runs).toEqual(['prev:dry', 'prev:real'])
    expect(editor.getText()).toBe('A')
  })

  it('enabled: false gates both commands and leaves Tab/Shift-Tab unclaimed', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '  Hi' }] }]
    }
    const editor = track(createEditor(doc, { enabled: false }))
    editor.commands.setTextSelection(3) // after the leading indent — outdent would strip here
    expect(editor.commands.indent()).toBe(false)
    expect(editor.commands.outdent()).toBe(false)
    // False (not a handled no-op) so a host's own Tab handling still runs.
    expect(pressTab(editor)).toBe(false)
    expect(pressTab(editor, true)).toBe(false)
    expect(editor.getText()).toBe('  Hi')
  })

  it('indent prefixes each line across paragraphs (multiline uses \\n block separator)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'AA' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'BB' }] }
      ]
    }
    const editor = track(createEditor(doc))
    selectAcrossBlocks(editor, [
      { name: 'paragraph', text: 'AA' },
      { name: 'paragraph', text: 'BB' }
    ])
    const { from, to } = editor.state.selection
    const sep = '\n'
    const chunk = editor.state.doc.textBetween(from, to, sep)
    expect(chunk).toBe('AA\nBB')
    const lines = lineTextsWithOffsets(chunk)
    expect(lines.map((l) => l.offset)).toEqual([0, 3])
    const p0 = docPosAtChunkOffset(editor.state.doc, from, to, 0, sep)
    const p3 = docPosAtChunkOffset(editor.state.doc, from, to, 3, sep)
    expect(p0).toBe(from)
    expect(p3).not.toBe(p0)
    expect(editor.state.doc.textBetween(from, p3, sep)).toBe('AA\n')
    expect(editor.commands.indent()).toBe(true)
    const t = editor.getText()
    expect(t).toContain('  AA')
    expect(t).toContain('  BB')
  })
})
