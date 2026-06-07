// Production logger kept (not stripped) so sanitize/render failures stay
// visible in the field. `console.warn`/`console.error` survive the tsup
// `pure` policy by design (the kit relies on them).
export class Logger {
  private static isDebugMode = false

  static debug(message: string, data?: unknown): void {
    // eslint-disable-next-line no-console -- intentional debug logger, gated behind isDebugMode
    if (this.isDebugMode) console.debug(`[HyperMultimedia] ${message}`, data)
  }

  static warn(message: string, data?: unknown): void {
    console.warn(`[HyperMultimedia] ${message}`, data)
  }

  static error(message: string, error?: unknown): void {
    console.error(`[HyperMultimedia] ${message}`, error)
  }
}

// Tag/attribute allowlist sanitizer for untrusted embed HTML (X (formerly Twitter) oEmbed
// before `innerHTML`). Disallowed tags collapse to a text-only span; on any
// failure it falls back to text content so nothing executable survives.
export class HTMLSanitizer {
  private static allowedTags = [
    'div',
    'span',
    'button',
    'a',
    'strong',
    'em',
    'i',
    'b',
    'small',
    'blockquote',
    'p',
    'br'
  ]
  private static allowedAttributes = ['class', 'href', 'title', 'data-*', 'aria-*', 'role']
  // URL-bearing attrs must use a safe scheme even when the attr NAME is allowed.
  private static SAFE_URL = /^(?:https?:|mailto:|tel:|\/|#)/i

  private static isSafeUrl(value: string): boolean {
    const trimmed = value.trim()
    if (/^\/\//.test(trimmed)) return false
    return this.SAFE_URL.test(trimmed)
  }

  static sanitize(html: string): string {
    try {
      // Parse inertly: DOMParser does not execute scripts or fire `<img onerror>`
      // / `<svg onload>` handlers, so nothing runs before the scrub. [security: S3/S4]
      const doc = new DOMParser().parseFromString(html, 'text/html')
      this.sanitizeElement(doc.body)
      return doc.body.innerHTML
    } catch (error) {
      Logger.error('HTML sanitization failed', error)
      const div = document.createElement('div')
      div.textContent = html
      return div.innerHTML
    }
  }

  private static sanitizeElement(element: Element): void {
    const children = Array.from(element.children)

    children.forEach((child) => {
      if (!this.allowedTags.includes(child.tagName.toLowerCase())) {
        const span = document.createElement('span')
        span.textContent = child.textContent || ''
        child.parentNode?.replaceChild(span, child)
        return
      }

      Array.from(child.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase()
        if (!this.isAttributeAllowed(name)) {
          child.removeAttribute(attr.name)
          return
        }
        // Allowed-by-name url attrs still need a scheme gate.
        if ((name === 'href' || name === 'src') && !this.isSafeUrl(attr.value)) {
          child.removeAttribute(attr.name)
        }
      })

      this.sanitizeElement(child)
    })
  }

  private static isAttributeAllowed(attrName: string): boolean {
    return this.allowedAttributes.some((allowed) => {
      if (allowed.endsWith('*')) {
        return attrName.startsWith(allowed.slice(0, -1))
      }
      return attrName === allowed
    })
  }
}
