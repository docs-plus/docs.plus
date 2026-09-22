import {
  buildHistoryShareUrl,
  copyVersionLinkTitle
} from '@components/pages/history/historyShareUrl'
import { useCopyToClipboard } from '@hooks/useCopyToClipboard'
import { useCallback } from 'react'

export function useCopyHistoryVersionLink(
  version: number | undefined,
  createdAt: string | undefined
) {
  const { copy: copyText, copied } = useCopyToClipboard({
    successMessage: 'Link copied',
    errorMessage: "Couldn't copy link"
  })

  const copy = useCallback(async () => {
    if (version == null) return
    await copyText(buildHistoryShareUrl(version))
  }, [version, copyText])

  const idleLabel = createdAt ? copyVersionLinkTitle(createdAt) : 'Copy link'

  return { copy, copied, label: copied ? 'Copied!' : idleLabel }
}
