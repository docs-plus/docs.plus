import { find } from 'linkifyjs'

type ValidateURLOptions = {
  customValidator?: (url: string) => boolean
}

export const validateURL = (url: string, options?: ValidateURLOptions): boolean => {
  if (!url.trim()) return false

  try {
    const links = find(url).filter((link) => link.isLink)
    const validURL = links.filter((link) => {
      if (options?.customValidator) {
        return options.customValidator(link.value)
      }
      return true
    })[0]

    return !!validURL?.href
  } catch (error) {
    console.error('URL validation error:', error)
    return false
  }
}
