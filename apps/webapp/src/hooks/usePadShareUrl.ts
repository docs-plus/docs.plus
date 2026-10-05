import { useStore } from '@stores'
import { padSlugOf } from '@utils/filterRoute'

/** Client only: it reads `window.location`. Share and the pad QR card both call it. */
export function usePadShareUrl(): string {
  const slug = useStore((state) => state.settings.metadata?.slug)
  // Always the whole document: the address bar can carry heading, chat and filter state.
  return `${window.location.origin}/${slug || padSlugOf(window.location.pathname)}`
}
