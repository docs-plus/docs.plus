import { getDocumentFollowState, setDocumentFollow } from '@api'
import * as toast from '@components/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

/**
 * Follow state for one document. The read answers `null` when the caller has no
 * membership row. `typeof data === 'boolean'` treats that null and a still-pending
 * read alike, so the caller gates the read on membership, not on sign-in.
 */
export function useDocumentFollow(args: { documentId: string; enabled: boolean }) {
  const { documentId, enabled } = args
  const queryClient = useQueryClient()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  const { data } = useQuery({
    queryKey: ['document-follow', documentId],
    // Both follow RPCs are revoked from `anon`, so an unguarded read 403s.
    enabled: enabled && Boolean(documentId),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await getDocumentFollowState({ documentId })
      if (res.error) throw res.error
      return res.data
    }
  })

  const isMember = typeof data === 'boolean'
  // A fresh member follows by default, so a pending or `null` read must not paint "off".
  const following = optimistic ?? (isMember ? data : true)

  const toggle = useCallback(async () => {
    const previous = following
    const next = !previous
    setOptimistic(next)
    setSaving(true)
    const res = await setDocumentFollow({ documentId, follow: next })
    setSaving(false)
    // The write returns `found`: no membership row answers `false`, not an error.
    if (res.error || !res.data) {
      setOptimistic(previous)
      toast.Error('Could not change the follow setting')
      return
    }
    // The panel unmounts on close, so the cache — not local state — carries the flip.
    queryClient.setQueryData(['document-follow', documentId], next)
  }, [documentId, following, queryClient])

  return { following, canToggle: isMember && !saving, toggle }
}
