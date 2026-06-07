import metascraper from 'metascraper'
import author from 'metascraper-author'
import date from 'metascraper-date'
import description from 'metascraper-description'
import image from 'metascraper-image'
import lang from 'metascraper-lang'
import logo from 'metascraper-logo'
import publisher from 'metascraper-publisher'
import title from 'metascraper-title'
import url from 'metascraper-url'

import type { Scraper } from '../domain/types'

/**
 * Implements the `Scraper` port using metascraper + 9 plugins. The
 * instance is built once per `init()` call and held in closure (see
 * boundary rule 6: no module-level singletons).
 */
export const createMetascraper = (): Scraper => {
  const scraper = metascraper([
    title(),
    description(),
    image(),
    logo(),
    author(),
    publisher(),
    url(),
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
        lang: meta.lang,
        url: meta.url
      }
    }
  }
}
