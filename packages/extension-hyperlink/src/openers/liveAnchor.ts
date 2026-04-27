import type { Editor } from '@tiptap/core'

/** Best-effort recovery for anchors ProseMirror replaced during a popover transition. */
export function findLiveEquivalentAnchor(
  editor: Editor,
  link: HTMLAnchorElement,
  nodePos?: number
): HTMLAnchorElement | null {
  if (link.isConnected) return link
  if (typeof nodePos === 'number') {
    try {
      const { node } = editor.view.domAtPos(nodePos)
      const element =
        'closest' in node
          ? (node as Element)
          : 'parentElement' in node
            ? (node.parentElement as Element | null)
            : null
      const anchor = element?.closest<HTMLAnchorElement>('a')
      if (anchor && editor.view.dom.contains(anchor)) return anchor
    } catch {
      // Fall through to href+text recovery below.
    }
  }

  const href = link.getAttribute('href')
  const text = link.textContent
  const links = Array.from(editor.view.dom.querySelectorAll<HTMLAnchorElement>('a'))
  return (
    links.find(
      (candidate) => candidate.getAttribute('href') === href && candidate.textContent === text
    ) ?? null
  )
}
