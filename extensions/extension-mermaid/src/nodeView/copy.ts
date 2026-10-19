function copyWithTextarea(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  try {
    area.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

/** Resolves true when the text was copied. The clipboard call starts synchronously, so the click gesture still counts. */
export function copyText(text: string): Promise<boolean> {
  try {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => copyWithTextarea(text)
    )
  } catch {
    return Promise.resolve(copyWithTextarea(text))
  }
}
