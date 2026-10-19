import { element } from './element'

const SVG_NS = 'http://www.w3.org/2000/svg'

type Shape = [tag: string, attrs: Record<string, string>]

type IconName = 'help' | 'copy' | 'check' | 'chevron'

const ICONS: Record<IconName, Shape[]> = {
  help: [
    ['circle', { cx: '8', cy: '8', r: '6' }],
    ['path', { d: 'M6.2 6.3a1.9 1.9 0 0 1 3.6.7c0 1.3-1.8 1.5-1.8 2.6M8 11.7h.01' }]
  ],
  copy: [
    ['rect', { x: '5.5', y: '5.5', width: '8', height: '8', rx: '1.5' }],
    [
      'path',
      { d: 'M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5' }
    ]
  ],
  check: [['path', { d: 'M3 8.5l3.2 3.2L13 4.8' }]],
  chevron: [['path', { d: 'M4 6l4 4 4-4' }]]
}

export function createIcon(...names: IconName[]): HTMLSpanElement {
  const wrap = element('span', 'mermaid-diagram__icon')
  for (const name of names) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('width', '14')
    svg.setAttribute('height', '14')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '1.5')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    for (const [tag, attrs] of ICONS[name]) {
      const shape = document.createElementNS(SVG_NS, tag)
      for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value)
      svg.append(shape)
    }
    wrap.append(svg)
  }
  return wrap
}

export function createText(text: string): HTMLSpanElement {
  const span = element('span', 'mermaid-diagram__text')
  span.textContent = text
  return span
}
