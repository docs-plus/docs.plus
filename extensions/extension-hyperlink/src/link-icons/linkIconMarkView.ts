import type { MarkViewRenderer } from '@tiptap/core'
import { DOMSerializer, type Mark } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { isSafeHref } from '../url-decisions'
import { logger } from '../utils/logger'
import type { LinkIconResolver } from './types'

// Security: build <a> only through toDOM, with prosemirror-view's own arguments (viewdesc.ts:630).
// renderHTML blanks unsafe hrefs; the attrs argument keeps renderSpec's XSS check.
const drawAnchor = (m: Mark, inline: boolean): { dom: HTMLElement; contentDOM?: HTMLElement } =>
  (DOMSerializer.renderSpec as any)(document, m.type.spec.toDOM!(m, inline), null, m.attrs)
const plainAnchor: MarkViewRenderer = ({ mark, inline }) => drawAnchor(mark, inline)
const renderers = new WeakMap<LinkIconResolver, MarkViewRenderer>() // addMarkView() runs per mark view
const pending = new WeakMap<EditorView, Set<() => void>>() // sweeps held back during IME, one set per view
// The point just before (d = 0) or just after (d = 1) n in its parent.
const beside = (n: Node, d: 0 | 1): [Node | null, number] => {
  const p = n.parentNode
  return p ? [p, Array.prototype.indexOf.call(p.childNodes, n) + d] : [null, 0]
}
// setBaseAndExtent throws IndexSizeError on an offset past the end of its node.
const fits = (n: Node, o: number): boolean =>
  o <= (n.nodeType === Node.ELEMENT_NODE ? n.childNodes.length : (n.textContent ?? '').length)

// Our handler runs before prosemirror-view's own (input.ts:50-52); the microtask runs after it, with composing false.
export const linkIconCompositionSweep = new Plugin({
  props: {
    handleDOMEvents: {
      compositionend(view) {
        const s = pending.get(view)
        if (s?.size)
          Promise.resolve().then(() => {
            // Clear before the sweeps run, so a throw cannot leave stale entries for the next compositionend.
            const sweeps = Array.from(s)
            s.clear()
            try {
              for (const f of sweeps) f()
            } catch (e) {
              logger.error('link icon sweep failed after composition', e)
            }
          })
        return false // true would skip prosemirror-view's own compositionend
      }
    }
  }
})

export function linkIconMarkView(linkIcon?: LinkIconResolver): MarkViewRenderer {
  if (!linkIcon) return plainAnchor
  const cached = renderers.get(linkIcon)
  if (cached) return cached
  let warned = false
  const warn = (msg: string, e?: unknown) => {
    if (!warned) {
      warned = true
      logger.error(msg, e)
    }
  }
  const resolve = (href: unknown): HTMLElement | null => {
    if (typeof href !== 'string' || !href || !isSafeHref(href)) return null // renderHTML blanks it to ''
    let el: unknown
    try {
      el = linkIcon({ href })
    } catch (e) {
      warn('linkIcon threw; the link stays plain', e)
      return null
    }
    // parentNode, not isConnected: prosemirror-view renders a paragraph's links before it attaches them
    if (el instanceof HTMLElement && !el.parentNode && !el.textContent) return el
    if (el != null) warn('linkIcon must return a fresh element with no text')
    return null
  }
  const renderer: MarkViewRenderer = ({ mark, view, inline }) => {
    const spec = drawAnchor(mark, inline),
      icon = resolve(mark.attrs.href)
    if (!icon) return spec // plain link: the same DOM as today
    const { dom } = spec,
      hole = spec.contentDOM ?? dom,
      contentDOM = document.createElement('span')
    icon.classList.add('hyperlink-icon')
    icon.setAttribute('aria-hidden', 'true')
    icon.contentEditable = 'false' // ProseMirror sets this on widgets only
    if (icon instanceof HTMLImageElement) icon.draggable = false
    hole.append(icon, contentDOM)
    let owned = dom.getAttributeNames()
    // Move stray text into contentDOM. insertBefore resets a caret inside it (DOM remove steps), so put it back.
    const sweep = () => {
      if (!hole.isConnected) return
      if (contentDOM.parentNode !== hole) hole.append(contentDOM) // a native edit removed the span
      const ds = (view.root as Document).getSelection()
      let a = ds?.anchorNode,
        ao = ds?.anchorOffset ?? 0,
        f = ds?.focusNode,
        fo = ds?.focusOffset ?? 0
      // An element offset on hole or contentDOM shifts when the move edits that child list.
      // Pin it to a neighbour and find that neighbour again after the move. Prefer a text node,
      // then a stray, which the move carries into contentDOM with the caret beside it.
      type Point = () => [Node | null | undefined, number]
      const pin = (n: Node | null | undefined, o: number): Point => {
        if (n !== hole && n !== contentDOM) return () => [n, o]
        const before = n.childNodes[o - 1],
          after = n.childNodes[o]
        if (before?.nodeType === Node.TEXT_NODE) return () => [before, before.textContent!.length]
        if (after?.nodeType === Node.TEXT_NODE) return () => [after, 0]
        const stray = (c?: Node) => !!c && c !== icon && c !== contentDOM
        if (before && (stray(before) || !stray(after))) return () => beside(before, 1)
        if (after) return () => beside(after, 0)
        return () => [n, o]
      }
      const anchorAt = pin(a, ao),
        focusAt = pin(f, fo)
      const head = contentDOM.firstChild // fixed, so strays keep their order
      for (const n of Array.from(hole.childNodes))
        if (n !== icon && n !== contentDOM)
          contentDOM.insertBefore(
            n,
            n.compareDocumentPosition(contentDOM) & Node.DOCUMENT_POSITION_FOLLOWING ? head : null
          )
      if (!icon.parentNode) hole.prepend(icon) // a native delete removed the icon
      ;[a, ao] = anchorAt()
      ;[f, fo] = focusAt()
      if (
        ds &&
        a &&
        f &&
        a.isConnected &&
        f.isConnected &&
        fits(a, ao) &&
        fits(f, fo) &&
        (ds.anchorNode !== a ||
          ds.anchorOffset !== ao ||
          ds.focusNode !== f ||
          ds.focusOffset !== fo)
      )
        ds.setBaseAndExtent(a, ao, f, fo)
    }
    return {
      dom,
      contentDOM,
      update(next) {
        // keeps the icon on a title or image write; never call linkIcon here (new request)
        if (next.attrs.href !== mark.attrs.href) return false
        const fresh = drawAnchor(next, inline).dom
        for (const n of owned) if (!fresh.hasAttribute(n)) dom.removeAttribute(n)
        owned = fresh.getAttributeNames()
        for (const n of owned) dom.setAttribute(n, fresh.getAttribute(n)!)
        return true
      },
      ignoreMutation(m) {
        if (m.type === 'selection') return false
        if (icon.contains(m.target)) return true // img load, hidden toggle
        if (m.type !== 'childList' || m.target !== hole) return false
        if (view.composing) {
          // a sweep mid-IME would break the composition
          let s = pending.get(view)
          if (!s) pending.set(view, (s = new Set()))
          s.add(sweep)
          return false
        }
        sweep()
        return false
      }
    }
  }
  renderers.set(linkIcon, renderer)
  return renderer
}
