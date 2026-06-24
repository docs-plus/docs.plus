const GIPHY_API = 'https://api.giphy.com/v1/gifs'

export type GiphyGif = {
  id: string
  title: string
  previewUrl: string
  originalUrl: string
  width: number
  height: number
}

type GiphyResponse = {
  data?: Array<{
    id: string
    title: string
    images: {
      fixed_width: { url: string; width: string; height: string }
      original: { url: string; width: string; height: string }
    }
  }>
}

function mapGif(entry: NonNullable<GiphyResponse['data']>[number]): GiphyGif {
  return {
    id: entry.id,
    title: entry.title || 'GIF',
    previewUrl: entry.images.fixed_width.url,
    originalUrl: entry.images.original.url,
    width: Number(entry.images.original.width) || 480,
    height: Number(entry.images.original.height) || 270
  }
}

export async function searchGiphy(query: string, limit = 12): Promise<GiphyGif[]> {
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY
  if (!apiKey?.trim()) return []

  const params = new URLSearchParams({
    api_key: apiKey,
    q: query.trim() || 'reactions',
    limit: String(limit),
    rating: 'pg-13'
  })

  const response = await fetch(`${GIPHY_API}/search?${params.toString()}`)
  if (!response.ok) return []

  const body = (await response.json()) as GiphyResponse
  return (body.data ?? []).map(mapGif)
}

export async function fetchTrendingGifs(limit = 12): Promise<GiphyGif[]> {
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY
  if (!apiKey?.trim()) return []

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(limit),
    rating: 'pg-13'
  })

  const response = await fetch(`${GIPHY_API}/trending?${params.toString()}`)
  if (!response.ok) return []

  const body = (await response.json()) as GiphyResponse
  return (body.data ?? []).map(mapGif)
}

export async function giphyGifToFile(gif: GiphyGif): Promise<File> {
  const response = await fetch(gif.originalUrl)
  if (!response.ok) throw new Error('Could not download GIF')
  const blob = await response.blob()
  const safeName = gif.title.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'gif'
  return new File([blob], `${safeName || 'gif'}.gif`, {
    type: blob.type || 'image/gif',
    lastModified: Date.now()
  })
}
