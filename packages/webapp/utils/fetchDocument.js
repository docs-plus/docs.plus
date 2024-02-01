export async function fetchDocument(slug, session) {
  let baseAPIUrl = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${slug}`
  const url = session ? `${baseAPIUrl}?userId=${session.user.id}` : baseAPIUrl
  const fetchOptions = session ? { headers: { token: session.access_token || '' } } : {}

  const documentMetadata = await fetch(url, fetchOptions).catch(console.error)
  const { data } = await documentMetadata.json().catch(console.error)

  const docClientId = `${data && data.isPrivate ? 'private' : 'public'}.${data.documentId}`

  return {
    ...data,
    docClientId
  }
}
