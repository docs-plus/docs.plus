import type { Editor, JSONContent } from '@tiptap/core'

import { sanitizeJsonContent } from '../components/TipTap/extensions/markdown-paste/markdownPastePlugin'

// `marked` parse is quadratic: 64 KiB costs ~0.6s on the main thread, 1 MiB costs minutes.
const MAX_IMPORT_SIZE = 64 * 1024

export function sanitizeFilename(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .slice(0, 200) || 'document'
  )
}

export function downloadAsMarkdown(editor: Editor, title: string): void {
  const body = editor.getMarkdown()
  const start = body.trimStart()
  // The pad's own first block is an H1, so prepending the title would export two.
  // An empty one does not count, or a titled document exports with no title at all.
  const bodyHasTitle = /^#[ \t]+\S/.test(start)
  const titleLine = !bodyHasTitle && title.trim() ? `# ${title.trim()}\n\n` : ''
  const content = titleLine + body

  const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const filename = sanitizeFilename(title.trim() || 'document') + '.md'
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()

  setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 10_000)
}

const inlineText = (node: JSONContent): string =>
  (node.content ?? []).map((child) => child.text ?? '').join('')

/**
 * The pad's doc node is `heading block*`, so a README that opens on a paragraph,
 * list, or table fails the schema check. Mirrors the three rules the server-side
 * importer applies, minus the branch it reports back to API callers.
 */
function withTitleHeading(doc: JSONContent, fallbackTitle: string): JSONContent {
  const content = doc.content ?? []
  const [first, ...rest] = content

  if (first?.type === 'heading')
    return { ...doc, content: [{ ...first, attrs: { ...first.attrs, level: 1 } }, ...rest] }

  if (first?.type === 'paragraph' && inlineText(first).trim())
    return {
      ...doc,
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          // Bold or highlighted runs inside a title read as damage, not intent.
          content: (first.content ?? []).map(({ marks, ...inline }) => inline)
        },
        ...rest
      ]
    }

  const title = fallbackTitle.trim()
  const heading: JSONContent = { type: 'heading', attrs: { level: 1 } }
  // An empty text node is not a legal ProseMirror node, so a blank stem stays bare.
  if (title) heading.content = [{ type: 'text', text: title }]
  return { ...doc, content: [heading, ...content] }
}

export function importMarkdownFile(editor: Editor): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt,text/markdown,text/plain'
    input.style.display = 'none'

    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      document.body.removeChild(input)

      if (!file) return resolve({ ok: false, error: 'No file selected' })
      if (file.size > MAX_IMPORT_SIZE)
        return resolve({ ok: false, error: `File too large (max ${MAX_IMPORT_SIZE / 1024} KB)` })

      let text: string
      try {
        text = await file.text()
      } catch {
        return resolve({ ok: false, error: 'Failed to read file' })
      }

      let parsed: JSONContent | undefined
      try {
        parsed = editor.markdown?.parse(text)
      } catch {
        return resolve({ ok: false, error: 'Failed to parse Markdown' })
      }
      if (!parsed) return resolve({ ok: false, error: 'Failed to parse Markdown' })

      const stem = file.name.replace(/\.[^.]+$/, '')
      try {
        editor.commands.setContent(withTitleHeading(sanitizeJsonContent(parsed), stem))
      } catch {
        return resolve({
          ok: false,
          error: 'This file uses formatting the editor doesn’t support'
        })
      }
      resolve({ ok: true })
    })

    input.addEventListener('cancel', () => {
      document.body.removeChild(input)
      resolve({ ok: false })
    })

    document.body.appendChild(input)
    input.click()
  })
}
