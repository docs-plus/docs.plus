import { pushAppUrlThenNotifyHashChange } from '@components/pages/history/historyShareUrl'
import { getDefaultController } from '@docs.plus/extension-hyperlink'
import { openChatFromLink } from '@services/openChatFromLink'
import { padUrl } from '@services/padUrl'
import { arriveAtHeading } from '@utils/arriveAtHeading'

import type { InternalDocumentLink } from './types'

const scrollDocumentToTop = (): void => {
  const wrapper = document.querySelector<HTMLElement>('.editorWrapper')
  if (wrapper) {
    wrapper.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  document.querySelector('.ProseMirror')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Run an in-document destination in place (no reload, no new tab) by reusing
 * the same primitives the legacy `navigateHref` ladder used. The open
 * hyperlink popover is dismissed first so every kind behaves the same.
 */
export function runInternalDocumentLink(link: InternalDocumentLink): void {
  getDefaultController().close()

  switch (link.kind) {
    case 'document':
      scrollDocumentToTop()
      return
    case 'heading':
      arriveAtHeading(link.headingId)
      return
    case 'chat':
      void openChatFromLink(link.linkId, {
        scroll2Heading: true,
        fetchMsgsFromId: link.messageId
      })
      return
    case 'filter':
      void padUrl.go({ kind: 'filterOpen', href: link.href })
      return
    case 'history': {
      const { pathname, search } = window.location
      const hash = link.version == null ? '#history' : `#history?version=${link.version}`
      pushAppUrlThenNotifyHashChange(`${pathname}${search}${hash}`)
      return
    }
    default: {
      const exhaustive: never = link
      return exhaustive
    }
  }
}
