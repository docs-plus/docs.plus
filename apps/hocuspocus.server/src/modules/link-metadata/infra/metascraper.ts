import metascraper from 'metascraper'
import author from 'metascraper-author'
import date from 'metascraper-date'
import description from 'metascraper-description'
import image from 'metascraper-image'
import lang from 'metascraper-lang'
import logo from 'metascraper-logo'
import publisher from 'metascraper-publisher'
import title from 'metascraper-title'

import type { Scraper } from '../domain/types'

export const createMetascraper = (): Scraper => {
  const scraper = metascraper([
    title(),
    // Bounds the description before metascraper's own regexes run. Without it, a long
    // whitespace run costs seconds (measured 152 ms -> 2288 ms at 4x input).
    description({ truncateLength: 300 }),
    image(),
    logo(),
    author(),
    publisher(),
    date(),
    lang()
  ])

  return {
    scrape: async ({ html, url: pageUrl }) => {
      const meta = (await scraper({ html, url: pageUrl })) as Record<string, string | undefined>
      return {
        title: meta.title,
        description: meta.description,
        image: meta.image,
        logo: meta.logo,
        author: meta.author,
        publisher: meta.publisher,
        date: meta.date,
        lang: meta.lang
      }
    }
  }
}
