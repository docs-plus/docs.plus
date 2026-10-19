import type { MermaidSnapshot, MermaidView, MermaidViewContext } from '../types'
import { element } from './element'

let nextId = 0

function messageFor({ state, error }: MermaidSnapshot): string {
  if (state === 'load-error') return 'Could not load the diagram renderer.'
  if (state === 'skipped') return 'This diagram was skipped.'
  if (error?.code === 'limit') return 'This diagram is too large to draw.'
  if (error?.code === 'unsupported-diagram') return 'This diagram type is not supported.'
  if (error?.code === 'render') return 'This diagram could not be drawn.'
  if (error && error.line > 0) {
    return `Line ${error.line}, column ${error.column}: this line has a mistake.`
  }
  return 'This diagram has a mistake.'
}

export function createDefaultView(context: MermaidViewContext): MermaidView {
  const dom = element('div', 'mermaid-diagram__preview')
  const diagram = element('div', 'mermaid-diagram__diagram')
  const spinner = element('span', 'mermaid-diagram__spinner')
  const errorLine = element('p', 'mermaid-diagram__error')
  const message = element('span', 'mermaid-diagram__message')
  const detail = element('code', 'mermaid-diagram__detail')
  const retry = element('button', 'mermaid-diagram__retry')

  const errorId = `mermaid-diagram-error-${++nextId}`
  errorLine.id = errorId
  errorLine.hidden = true
  retry.hidden = true
  retry.type = 'button'
  retry.textContent = 'Try again'
  retry.addEventListener('click', () => context.retry())
  spinner.setAttribute('aria-hidden', 'true')

  errorLine.append(message, detail, retry)
  diagram.append(spinner)
  dom.append(diagram, errorLine)

  return {
    dom,
    diagram,
    update(snapshot) {
      const { state, error } = snapshot
      // The first draw clears the host itself; this covers a state that never draws.
      if (state !== 'loading') spinner.remove()

      const showError = state === 'error' || state === 'load-error' || state === 'skipped'
      errorLine.hidden = !showError
      if (state === 'loading') diagram.setAttribute('aria-busy', 'true')
      else diagram.removeAttribute('aria-busy')
      retry.hidden = state !== 'load-error'
      message.textContent = showError ? messageFor(snapshot) : ''
      detail.textContent =
        showError && error
          ? error.message
              .split('\n')
              .filter((line) => line.trim() !== '')
              .join('\n')
          : ''

      if (showError) diagram.setAttribute('aria-describedby', errorId)
      else diagram.removeAttribute('aria-describedby')
    }
  }
}
