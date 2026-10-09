type LinkedHeadingInput = {
  /** The id a chat link carries: a channel id (push, email, message link) or a heading id (share). */
  linkId: string
  /** heading_id of the channel `linkId` names in the open document, else null. */
  channelHeadingId: string | null
  /** True when `linkId` is a toc-id in the open document. */
  isLiveHeading: boolean
  documentId: string
}

/**
 * Which heading a chat link opens, or null for none (#402). A channel of another
 * document is neither a row here nor a heading here, so it opens nothing.
 */
export function pickLinkedHeading({
  linkId,
  channelHeadingId,
  isLiveHeading,
  documentId
}: LinkedHeadingInput): string | null {
  if (channelHeadingId) return channelHeadingId
  if (isLiveHeading || linkId === documentId) return linkId
  return null
}
