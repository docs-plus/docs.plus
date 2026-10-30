import { isMacOS } from '@tiptap/core'

const MOD_ATTR = 'data-hyperlink-mod'
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

// Editors share one document, so the listeners and the flag live once per document.
const refCounts = new WeakMap<Document, number>()

/** The platform Mod key: Cmd on macOS, Ctrl elsewhere. */
export function hasMod(event: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>): boolean {
  return isMacOS() ? event.metaKey : event.ctrlKey
}

function docOf(event: Event): Document {
  const target = event.currentTarget as Document | Window
  // A node-type test: `'document' in doc` is true when the page has `<form name="document">`.
  return (target as Node).nodeType === Node.DOCUMENT_NODE
    ? (target as Document)
    : (target as Window).document
}

function setFlag(doc: Document, on: boolean): void {
  doc.documentElement.toggleAttribute(MOD_ATTR, on)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.repeat) return
  const modKey = isMacOS() ? 'Meta' : 'Control'
  // A shortcut such as Mod+K is not a click intent, so it drops the hand.
  if (event.key === modKey) setFlag(docOf(event), true)
  else if (!MODIFIER_KEYS.has(event.key)) setFlag(docOf(event), false)
}

function clearFlag(event: Event): void {
  setFlag(docOf(event), false)
}

// A keyup can be lost, for example in another window. Entering a link reads the real state.
function onPointerOver(event: PointerEvent): void {
  const target = event.target as Element | null
  if (!target?.closest?.('a[href]')) return
  setFlag(docOf(event), hasMod(event))
}

/**
 * Sets `data-hyperlink-mod` on `<html>` while Mod is held, so CSS can show the hand
 * over links. Counted per document; the last detach removes the listeners and the flag.
 */
export function attachModCursor(doc: Document): () => void {
  const win = doc.defaultView
  const count = refCounts.get(doc) ?? 0
  refCounts.set(doc, count + 1)
  if (count === 0) {
    doc.addEventListener('keydown', onKeyDown, true)
    doc.addEventListener('keyup', clearFlag, true)
    doc.addEventListener('visibilitychange', clearFlag)
    doc.addEventListener('pointerover', onPointerOver, true)
    win?.addEventListener('blur', clearFlag)
  }

  let attached = true
  return () => {
    if (!attached) return
    attached = false
    const left = (refCounts.get(doc) ?? 1) - 1
    if (left > 0) {
      refCounts.set(doc, left)
      return
    }
    refCounts.delete(doc)
    doc.removeEventListener('keydown', onKeyDown, true)
    doc.removeEventListener('keyup', clearFlag, true)
    doc.removeEventListener('visibilitychange', clearFlag)
    doc.removeEventListener('pointerover', onPointerOver, true)
    win?.removeEventListener('blur', clearFlag)
    setFlag(doc, false)
  }
}
