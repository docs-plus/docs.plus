import type { Editor } from '@tiptap/core'

import { sanitizeJsonContent } from '../components/TipTap/extensions/markdown-paste/markdownPastePlugin'

const MAX_IMPORT_SIZE = 2_000_000 // 2 MB

export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .slice(0, 200) || 'document'
  )
}

export function downloadAsMarkdown(editor: Editor, title: string): void {
  const titleLine = title.trim() ? `# ${title.trim()}\n\n` : ''
  const body = editor.getMarkdown()
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
        return resolve({ ok: false, error: 'File too large (max 2 MB)' })

      try {
        const text = await file.text()
        const json = editor.markdown?.parse(text)
        if (!json) return resolve({ ok: false, error: 'Failed to parse Markdown' })

        editor.commands.setContent(sanitizeJsonContent(json))
        resolve({ ok: true })
      } catch {
        resolve({ ok: false, error: 'Failed to read file' })
      }
    })

    input.addEventListener('cancel', () => {
      document.body.removeChild(input)
      resolve({ ok: false })
    })

    document.body.appendChild(input)
    input.click()
  })
}
