import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><div id="ed"></div>', { pretendToBeVisual: true })
const w = dom.window
const names = [
  'window',
  'document',
  'navigator',
  'MutationObserver',
  'getComputedStyle',
  'Node',
  'HTMLElement',
  'HTMLImageElement',
  'Element',
  'Text',
  'DOMParser',
  'getSelection',
  'Event',
  'CompositionEvent',
  'MouseEvent',
  'KeyboardEvent',
  'requestAnimationFrame',
  'cancelAnimationFrame'
] as const
for (const k of names) {
  const v = (w as any)[k]
  ;(globalThis as any)[k] =
    k === 'window' ? w : typeof v === 'function' && /^[a-z]/.test(k) ? v.bind(w) : v
}
// jsdom has no layout. prosemirror-view asks for rects when it scrolls the selection.
w.Range.prototype.getClientRects = () => [] as any
w.Range.prototype.getBoundingClientRect = () =>
  ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) as any
// jsdom has no elementFromPoint; posAtCoords then returns null outside the zero editor rect.
;(w.document as any).elementFromPoint = () => null
// jsdom 26 spends about 3 s on matches(':modal'). floating-ui asks it on every popover position.
const matches = w.Element.prototype.matches
w.Element.prototype.matches = function (this: Element, selector: string) {
  return selector === ':modal' ? false : matches.call(this, selector)
}
