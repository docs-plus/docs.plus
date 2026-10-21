const MEDIA_ROUTE = '/plugins/hypermultimedia/'
const MEDIA_SESSION_URL = `${process.env.NEXT_PUBLIC_RESTAPI_URL}${MEDIA_ROUTE}session`

type MediaElement = HTMLImageElement | HTMLMediaElement

let postedAccessToken: string | null = null
let inFlightPost: Promise<void> = Promise.resolve()
// Goes up only when REST set a cookie, so a failed POST never spends a retry.
let cookieGeneration = 0
const retriedInGeneration = new WeakMap<Element, number>()
const waitingForCookie = new Set<MediaElement>()

const reloadMedia = (el: MediaElement): void => {
  if (!el.isConnected) return
  retriedInGeneration.set(el, cookieGeneration)
  // The media shell settled to `error` and dropped its listeners, so mark it ready here.
  // `loadeddata` comes before `canplay`, the other event the shell waits for.
  const host = el.closest<HTMLElement>('[data-hm-loading]')
  el.addEventListener(
    el instanceof HTMLImageElement ? 'load' : 'loadeddata',
    () => {
      if (host) host.dataset.hmLoading = 'ready'
    },
    { once: true }
  )
  if (el instanceof HTMLMediaElement) {
    el.load()
    return
  }
  const src = el.src
  el.src = ''
  el.src = src
}

/**
 * A Private document's media loads through a plain `src`, which carries no token.
 * REST trades the token for an HttpOnly cookie that the media route reads. The token
 * compare absorbs auth-js re-firing SIGNED_IN on tab focus; a failure clears it.
 */
export const postMediaSession = (token: string): void => {
  if (token === postedAccessToken) return
  postedAccessToken = token
  inFlightPost = fetch(MEDIA_SESSION_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { token }
  })
    .then((res) => {
      if (!res.ok) throw new Error(`media session ${res.status}`)
      cookieGeneration++
      for (const el of waitingForCookie) reloadMedia(el)
      waitingForCookie.clear()
    })
    .catch(() => {
      if (postedAccessToken === token) postedAccessToken = null
    })
}

/** JavaScript cannot clear the HttpOnly cookie, so REST expires it. Never rejects. */
export const clearMediaSession = async (signal?: AbortSignal): Promise<void> => {
  postedAccessToken = null
  // A POST still in flight could set the cookie again after this DELETE.
  await Promise.race([
    inFlightPost,
    new Promise((resolve) => signal?.addEventListener('abort', resolve, { once: true }))
  ])
  await fetch(MEDIA_SESSION_URL, { method: 'DELETE', credentials: 'include', signal }).catch(
    () => {}
  )
}

/**
 * A pad can paint from its local copy before the cookie lands, and an image whose
 * request 404s never retries. So a failed docs.plus media element retries at most
 * once per cookie REST sets. Returns the unsubscribe.
 */
export const retryMediaAfterSession = (): (() => void) => {
  const onError = (event: Event) => {
    const el = event.target
    if (!(el instanceof HTMLImageElement) && !(el instanceof HTMLMediaElement)) return
    if (!el.getAttribute('src')?.includes(MEDIA_ROUTE)) return
    // A cookie newer than this element's last retry may already exist: try it now.
    if (cookieGeneration > (retriedInGeneration.get(el) ?? 0)) reloadMedia(el)
    else waitingForCookie.add(el)
  }
  // `error` does not bubble, so listen in the capture phase.
  document.addEventListener('error', onError, true)
  return () => document.removeEventListener('error', onError, true)
}
