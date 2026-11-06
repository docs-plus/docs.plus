import { padUrl } from '@services/padUrl'
import { useRouter } from 'next/router'
import type { MouseEvent } from 'react'

const isPlainLeftClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

/**
 * A plain left click routes in this tab and closes Settings (#699). Every other click
 * (middle, Cmd/Ctrl, Shift) stays with the browser, so the link opens a new tab or window.
 */
export function useDocumentLink(slug: string, onOpenDocument?: () => void) {
  const router = useRouter()
  const href = padUrl.link({ kind: 'document', slug }, 'path')
  const onClick = (e: MouseEvent) => {
    if (!isPlainLeftClick(e)) return
    e.preventDefault()
    router.push(href)
    onOpenDocument?.()
  }
  return { href, onClick }
}
