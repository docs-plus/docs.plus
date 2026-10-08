import { useStore } from '@stores'
import { fetchDocument } from '@utils/fetchDocument'
import { supabaseClient } from '@utils/supabase'

export const plainTitle = (value: string): string => value.replace(/<[^>]*>/g, '')

export const REFETCH_GAP_MS = 2000

let inFlight = false
let again = false

async function refetchTitle(): Promise<void> {
  const slug = useStore.getState().settings.metadata?.slug
  if (!slug) return
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const doc = await fetchDocument(slug, session)

  // Read again: the user may have changed pads while the GET ran.
  const { settings, setWorkspaceSetting } = useStore.getState()
  if (!doc || doc.documentId !== settings.metadata?.documentId) return
  const title = plainTitle(doc.title ?? '')
  if (title === settings.metadata.title) return
  setWorkspaceSetting('metadata', { ...settings.metadata, title })
}

// The relay has no authz, so anyone in the room can send docTitle. The payload is
// only a signal; REST is the authority. One GET is in flight at a time, and the
// trailing rerun waits REFETCH_GAP_MS, so a forged stream costs each viewer one GET per gap.
export function onDocTitleStateless(payload: string): void {
  try {
    if ((JSON.parse(payload) as { type?: unknown } | null)?.type !== 'docTitle') return
  } catch {
    return
  }
  if (inFlight) {
    again = true
    return
  }
  inFlight = true
  void (async () => {
    do {
      again = false
      await refetchTitle().catch(() => undefined)
      if (again) await new Promise((resolve) => setTimeout(resolve, REFETCH_GAP_MS))
    } while (again)
    inFlight = false
  })()
}

export function sendDocTitleStateless(
  sender: { sendStateless: (payload: string) => void } | null | undefined,
  title: string
): void {
  sender?.sendStateless(JSON.stringify({ type: 'docTitle', state: { title: plainTitle(title) } }))
}
