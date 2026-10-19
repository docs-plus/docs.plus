export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.className = className
  return el
}
