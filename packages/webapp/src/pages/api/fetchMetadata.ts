import type { NextApiRequest, NextApiResponse } from 'next'
import ogs from 'open-graph-scraper'
import { URL } from 'url'
import axios from 'axios'
import * as cheerio from 'cheerio'
import randomColor from 'randomcolor'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'No URL provided' })
  }

  try {
    let formattedUrl
    const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`

    try {
      formattedUrl = new URL(urlWithProtocol)
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }

    if (!formattedUrl.protocol.startsWith('http')) {
      formattedUrl.protocol = 'https:'
    }

    const options = { url: formattedUrl.toString() }

    async function getMetaTags(url: string) {
      const response = await axios.get(url)
      const $ = cheerio.load(response.data)
      const metaTags: Record<string, string> = {}

      $('meta').each((_, element) => {
        const name = $(element).attr('name') || $(element).attr('property')
        const content = $(element).attr('content')
        if (name && content) {
          metaTags[name] = content
        }
      })

      return metaTags
    }

    const [ogsResult, metaTags] = await Promise.all([
      ogs(options),
      getMetaTags(formattedUrl.toString())
    ])

    const { error, result } = ogsResult

    const themeColor =
      metaTags['theme-color'] ||
      metaTags['msapplication-TileColor'] ||
      // @ts-ignore
      result.customMetaTags?.find((tag: { name: string }) => tag.name === 'theme-color')?.content ||
      randomColor({ luminosity: 'light' })

    let iconUrl = result.favicon || ''
    let socialBannerUrl = ''
    let iconSize = null
    let socialBannerSize = null

    if (result.ogImage && result.ogImage[0]) {
      const image = result.ogImage[0]

      if (!iconUrl) {
        iconSize = {
          width: image.width || null,
          height: image.height || null
        }
      }

      socialBannerUrl = image.url || ''
      socialBannerSize = {
        width: image.width || null,
        height: image.height || null
      }
    }

    if (iconUrl && !iconUrl.match(/^https?:\/\//)) {
      iconUrl = new URL(iconUrl, formattedUrl.toString()).toString()
    }
    if (socialBannerUrl && !socialBannerUrl.match(/^https?:\/\//)) {
      socialBannerUrl = new URL(socialBannerUrl, formattedUrl.toString()).toString()
    }
    const metadata = {
      // @ts-ignore
      title: result.ogTitle || result.title || '',
      // @ts-ignore
      description: result.ogDescription || result.description || '',
      icon: iconUrl,
      socialBanner: socialBannerUrl,
      themeColor,
      ...(iconSize && { iconSize }),
      ...(socialBannerSize && { socialBannerSize })
    }

    res.status(200).json({ ...metadata })
  } catch (e) {
    console.error('Error fetching metadata:', {
      error: e instanceof Error ? e.message : String(e),
      url: url,
      stack: e instanceof Error ? e.stack : undefined
    })
    return res.status(200).json({
      title: '',
      description: '',
      icon: '',
      socialBanner: '',
      themeColor: randomColor({ luminosity: 'light' })
    })
  }
}
