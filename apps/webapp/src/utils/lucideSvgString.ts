import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { IconType } from 'react-icons'

// Icon components are module-stable and render identical markup per size, so the
// server-render cost is paid once and every later toolbar build is a cache hit.
const cache = new Map<IconType, Map<number, string>>()

/** Lucide (react-icons/lu) → memoized inline SVG string for imperative DOM (toolbar, node views). */
export function lucideSvgString(Icon: IconType, size = 18): string {
  let bySize = cache.get(Icon)
  if (!bySize) cache.set(Icon, (bySize = new Map()))
  let svg = bySize.get(size)
  if (svg === undefined) {
    svg = renderToStaticMarkup(createElement(Icon, { size, 'aria-hidden': true }))
    bySize.set(size, svg)
  }
  return svg
}
