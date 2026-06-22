import type { MediaLoadingKind, MediaLoadingShellContext } from './types'

const DEFAULT_MESSAGES: Record<MediaLoadingKind, string> = {
  image: 'Loading image…',
  video: 'Loading video…',
  audio: 'Loading audio…',
  embed: 'Loading embed…'
}

export function createDefaultMediaLoadingShell(context: MediaLoadingShellContext): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'hm-loading-shell__overlay'
  // No role="status"/aria-live: a persistent live-region inside the editor makes
  // focus-trap libraries (e.g. Floating UI markOthers) treat it as a keep-target and
  // recurse in, stamping `inert` across the doc — which ProseMirror reconciles by
  // recreating the media node views (the embed reloads).

  const shimmer = document.createElement('div')
  shimmer.className = 'hm-loading-shell__shimmer'
  shimmer.setAttribute('aria-hidden', 'true')
  overlay.append(shimmer)

  const body = document.createElement('div')
  body.className = 'hm-loading-shell__body'

  if (context.provider) {
    const provider = document.createElement('span')
    provider.className = 'hm-loading-shell__provider'
    provider.textContent = context.provider
    body.append(provider)
  }

  const message = document.createElement('span')
  message.className = 'hm-loading-shell__message'
  message.textContent = context.message ?? DEFAULT_MESSAGES[context.kind]
  body.append(message)

  const spinner = document.createElement('span')
  spinner.className = 'hm-loading-shell__spinner'
  spinner.setAttribute('aria-hidden', 'true')
  body.append(spinner)

  overlay.append(body)
  return overlay
}
