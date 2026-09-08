import Router from 'next/router'
import { useSyncExternalStore } from 'react'

const subscribers = new Set<() => void>()

function notifySubscribers(): void {
  for (const notify of subscribers) notify()
}

// One navigation wakes several of these, so every reader shares one set and React
// drops the repeats by comparing the hash string it already holds.
function subscribe(onStoreChange: () => void): () => void {
  if (subscribers.size === 0) {
    window.addEventListener('hashchange', notifySubscribers)
    window.addEventListener('popstate', notifySubscribers)
    Router.events.on('hashChangeComplete', notifySubscribers)
    Router.events.on('routeChangeComplete', notifySubscribers)
  }
  subscribers.add(onStoreChange)

  return () => {
    subscribers.delete(onStoreChange)
    if (subscribers.size > 0) return
    window.removeEventListener('hashchange', notifySubscribers)
    window.removeEventListener('popstate', notifySubscribers)
    Router.events.off('hashChangeComplete', notifySubscribers)
    Router.events.off('routeChangeComplete', notifySubscribers)
  }
}

function readHash(): string {
  return window.location.hash
}

// The pad tree is `ssr: false`, and the one reader that does hydrate consumes the
// hash inside an effect, so this empty first answer never reaches the screen.
function readServerHash(): string {
  return ''
}

/** The live `window.location.hash`. It parses nothing; each reader owns its own grammar. */
export function useLocationHash(): string {
  return useSyncExternalStore(subscribe, readHash, readServerHash)
}
