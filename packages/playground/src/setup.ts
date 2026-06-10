// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- forwards the *.css ambient (globals.d.ts) to consumers; inert until a consumer main.ts is typechecked
/// <reference path="./globals.d.ts" />

export interface PlaygroundTokens {
  light?: Record<string, string>
  dark?: Record<string, string>
}

export interface PlaygroundConfig {
  /** Page <title> and the card heading. */
  title: string
  /** Repo path appended to the GitHub footer link, e.g. `extension-hyperlink`. */
  github: string
  /** Per-theme CSS custom properties the extension's own styles consume. */
  tokens?: PlaygroundTokens
}

function vars(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k}:${v};`)
    .join('')
}

function applyTokens(tokens: PlaygroundTokens): void {
  const blocks: string[] = []
  if (tokens.light) blocks.push(`html[data-theme='light']{${vars(tokens.light)}}`)
  if (tokens.dark) blocks.push(`html[data-theme='dark']{${vars(tokens.dark)}}`)
  if (!blocks.length) return
  const style = document.createElement('style')
  style.textContent = blocks.join('')
  document.head.appendChild(style)
}

function wireThemeToggle(): void {
  const button = document.getElementById('theme-toggle')
  const root = document.documentElement
  if (!button) return
  const isDark = (): boolean => root.getAttribute('data-theme') === 'dark'
  const render = (): void => {
    const next = isDark() ? 'Light' : 'Dark'
    button.textContent = next
    button.title = `Switch to ${next.toLowerCase()} theme`
    button.setAttribute('aria-label', button.title)
  }
  button.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Ignore storage failures (private mode, blocked cookies).
    }
    render()
  })
  render()
}

export function setupPlayground({ title, github, tokens }: PlaygroundConfig): HTMLElement {
  document.title = title
  const heading = document.querySelector('h1')
  if (heading) heading.textContent = title
  const link = document.getElementById('playground-github')
  if (link instanceof HTMLAnchorElement) {
    link.href = `https://github.com/docs-plus/docs.plus/tree/main/extensions/${github}`
  }
  if (tokens) applyTokens(tokens)
  wireThemeToggle()
  const element = document.getElementById('editor')
  if (!element) throw new Error('#editor mount point missing')
  return element
}
