/**
 * @param {string} prefix
 * @returns {string}
 */
export const randstr = (prefix) => {
  return Math.random()
    .toString(36)
    .replace('0.', prefix || '')
}
