import { Icons } from '@icons'
import { useChatStore, useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import slugify from 'slugify'

function buildHeadingPath(editor: any, headingId: string): Array<{ text: string; id: string }> {
  const doc = editor.state.doc
  const result: Array<{ text: string; id: string; level: number }> = []
  let targetLevel = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)

    if (child.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

    const tocId = child.attrs['toc-id'] as string
    const level = child.attrs.level as number
    const text = child.textContent?.trim() || ''

    if (tocId === headingId) {
      targetLevel = level
      result.push({ text, id: tocId, level })
      break
    }

    result.push({ text, id: tocId, level })
  }

  if (targetLevel === 0) return []

  const ancestors: Array<{ text: string; id: string }> = []
  const seen = new Set<number>()

  for (let i = result.length - 2; i >= 0; i--) {
    const h = result[i]
    if (h.level < targetLevel && !seen.has(h.level)) {
      seen.add(h.level)
      ancestors.unshift({ text: h.text, id: h.id })
      if (h.level === 1) break
    }
  }

  const target = result[result.length - 1]
  return [...ancestors, { text: target.text, id: target.id }]
}

const BreadcrumbMobile = () => {
  const { query } = useRouter()
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const [headingPath, setHeadingPath] = useState<any>([])

  const workspaceId = useStore((state) => state.settings.workspaceId)
  const metadata = useStore((state) => state.settings.metadata)
  const editor = useStore((state) => state.settings.editor.instance)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const loading = useStore((state) => state.settings.editor.loading)

  useEffect(() => {
    if (!editor || providerSyncing || !headingId) return
    if (workspaceId === headingId) return

    const path = buildHeadingPath(editor, headingId)
    if (path.length === 0) return

    const headingAddress = path.map((x, index) => {
      const prevHeadingPath = path
        .slice(0, index)
        .map((h) => slugify(h.text, { lower: true, strict: true }))
        .join('>')

      const url = new URL(window.location.origin + `/${query.slugs?.at(0)}`)
      url.searchParams.set('h', prevHeadingPath)
      url.searchParams.set('id', x.id)

      return {
        ...x,
        slug: slugify(x.text),
        url: url.href
      }
    })

    updateChatRoom('headingPath', headingAddress)
    setHeadingPath(headingAddress)
  }, [headingId, editor, providerSyncing, loading])

  if (workspaceId === headingId) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-base-content truncate text-sm font-medium">{metadata.title}</p>
      </div>
    )
  }

  if (!headingPath.length) return null

  const ancestors = headingPath.slice(0, -1)
  const current = headingPath[headingPath.length - 1]

  return (
    <nav className="min-w-0 flex-1" aria-label="Breadcrumb">
      {ancestors.length > 0 && (
        <div className="text-base-content/50 flex min-w-0 items-center gap-0.5 truncate text-xs leading-tight">
          {ancestors.map((h: any, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <Icons.chevronRight size={10} className="shrink-0" />}
              <span className="truncate">{h.text}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <p
        className="text-base-content truncate text-sm leading-tight font-medium"
        aria-current="page">
        {current.text}
      </p>
    </nav>
  )
}

export default BreadcrumbMobile
