export const createHTMLElement = <K extends keyof HTMLElementTagNameMap>(
  type: K,
  props?: Partial<HTMLElementTagNameMap[K]>
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(type)

  if (props) {
    Object.assign(element, props)
  }

  return element
}
