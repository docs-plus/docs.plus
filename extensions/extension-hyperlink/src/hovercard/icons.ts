import type { HovercardFactIcon } from './types'

type Shape = [tag: string, attrs: Record<string, string>]

const CALENDAR: Shape[] = [
  ['path', { d: 'M8 2v4' }],
  ['path', { d: 'M16 2v4' }],
  ['rect', { width: '18', height: '18', x: '3', y: '4', rx: '2' }],
  ['path', { d: 'M3 10h18' }]
]

// Lucide paths, viewBox 0 0 24 24.
const ICONS: Record<HovercardFactIcon | 'copy' | 'open' | 'check', Shape[]> = {
  location: [
    [
      'path',
      {
        d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'
      }
    ],
    ['circle', { cx: '12', cy: '10', r: '3' }]
  ],
  work: [
    ['path', { d: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }],
    ['rect', { width: '20', height: '14', x: '2', y: '6', rx: '2' }]
  ],
  posted: CALENDAR,
  updated: CALENDAR,
  stars: [
    [
      'path',
      {
        d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'
      }
    ]
  ],
  language: [
    ['path', { d: 'm16 18 6-6-6-6' }],
    ['path', { d: 'm8 6-6 6 6 6' }]
  ],
  answers: [['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }]],
  accepted: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'm9 12 2 2 4-4' }]
  ],
  copy: [
    ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }]
  ],
  open: [
    ['path', { d: 'M15 3h6v6' }],
    ['path', { d: 'M10 14 21 3' }],
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }]
  ],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]]
}

type HovercardIcon = keyof typeof ICONS

const SVG_NS = 'http://www.w3.org/2000/svg'

/** False for a name outside the table, which a JS host can pass. */
export const hasIcon = (name: string): boolean => Object.prototype.hasOwnProperty.call(ICONS, name)

/** A 16px stroke icon. */
export const createIcon = (name: HovercardIcon): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const attrs: Record<string, string> = {
    width: '16',
    height: '16',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true'
  }
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value)
  for (const [tag, shapeAttrs] of ICONS[name]) {
    const el = document.createElementNS(SVG_NS, tag)
    for (const [key, value] of Object.entries(shapeAttrs)) el.setAttribute(key, value)
    svg.append(el)
  }
  return svg
}
