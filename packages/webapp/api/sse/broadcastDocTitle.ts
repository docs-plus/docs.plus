export const SSE_BROADCAST_TITLE_ADDRESS = (docId: string) =>
  `${process.env.NEXT_PUBLIC_SSE_URL}/${docId}`

export const broadcastDocTitle = async (documentId: string, newTitle: string) => {
  await fetch(SSE_BROADCAST_TITLE_ADDRESS(documentId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'updateTitle', title: newTitle })
  })
}
