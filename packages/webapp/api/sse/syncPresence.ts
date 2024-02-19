export const SSE_SYNC_PRESENCE = (docId: string) => `${process.env.NEXT_PUBLIC_SSE_URL}/${docId}`

export const broadcastPresence = async (
  documentId: string,
  channelId: string | null,
  userId: string
) => {
  await fetch(SSE_SYNC_PRESENCE(documentId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'syncPresence', getClients: true, channelId, userId })
  })
}
