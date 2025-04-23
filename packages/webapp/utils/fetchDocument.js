export async function fetchDocument(slug, session) {
  if (!slug) return null

  try {
    const baseAPIUrl = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${slug}`
    const url = session ? `${baseAPIUrl}?userId=${session.user.id}` : baseAPIUrl
    const headers = session?.access_token ? { token: session.access_token } : {}

    const response = await fetch(url, { headers })

    if (!response.ok) {
      console.error(`Document fetch failed: ${response.status} ${response.statusText}`)
      return null
    }

    const { data } = await response.json()

    if (!data) return null

    // Use optional chaining and nullish coalescing for safety
    const visibility = data?.isPrivate ? 'private' : 'public'
    const docClientId = `${visibility}.${data.documentId}`

    return { ...data, docClientId }
  } catch (error) {
    console.error('fetchDocument error:', error)
    return null
  }
}
