import type { NextApiRequest, NextApiResponse } from 'next'
import getMetaData from 'metadata-scraper'
type Data = {
  [key: string]: any
}

type ErrorResponse = {
  message: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | ErrorResponse>
) {
  if (req.method === 'POST') {
    const { url } = req.body

    if (!url) return res.status(400).json({ message: 'URL is required' })

    try {
      const metadata = await getMetaData(url)
      return res.status(200).json(metadata)
    } catch (error: unknown) {
      // We need to check that error is an instance of Error before accessing `message`
      if (error instanceof Error) {
        return res.status(500).json({ message: error.message })
      }

      // If it's not an Error instance or doesn't have a message, we can return a generic error message
      return res.status(500).json({ message: 'An unknown error occurred.' })
    }
  } else {
    // If not a POST request
    return res.status(405).json({ message: 'Method not allowed' })
  }
}
