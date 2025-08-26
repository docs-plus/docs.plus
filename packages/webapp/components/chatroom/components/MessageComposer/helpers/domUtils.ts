/**
 * Converts camelCase CSS property names to kebab-case
 * @param property - The camelCase property name
 * @returns The kebab-case CSS property name
 */
const camelToKebab = (property: string): string => {
  return property.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * Applies multiple CSS styles to an HTML element with !important priority
 * @param element - The HTML element to apply styles to
 * @param styles - Object containing CSS property-value pairs in camelCase
 */
export const applyStyles = (element: HTMLElement, styles: Record<string, string>): void => {
  Object.entries(styles).forEach(([property, value]) => {
    const cssProperty = camelToKebab(property)
    element.style.setProperty(cssProperty, value, 'important')
  })
}

/**
 * Removes CSS properties from an HTML element
 * @param element - The HTML element to remove styles from
 * @param properties - Array of CSS property names to remove (camelCase)
 */
export const removeStyles = (element: HTMLElement, properties: string[]): void => {
  properties.forEach((property) => {
    const cssProperty = camelToKebab(property)
    element.style.removeProperty(cssProperty)
  })
}
