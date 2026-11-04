import { decodeHTML } from 'entities'

import type { Scraper } from '../domain/types'
import { jobPostingFacts } from './jobPosting'

// Every captured value stops here, before any decode, JSON or regex work.
const VALUE_CAP = 4096
// Bounds on what a crafted page can make one scrape do: kept elements per kind, JSON-LD text
// (total and scripts), the @graph items and outer keys that flattening copies, and the nodes
// the JSON-LD fallback search visits in one scrape.
const ELEMENT_CAP = 5000
const JSON_LD_CAP = 512 * 1024
const JSON_LD_SCRIPTS = 20
const GRAPH_ITEMS = 200
const OUTER_KEYS = 50
const SEARCH_DEPTH = 8
const SEARCH_NODES = 20000
const DESCRIPTION_MAX = 300
const AUTHOR_MAX = 128

// Only elements a rule reads get a callback; each one costs about 0.1 µs, so a flood of short
// bare tags must not match.
const ELEMENT_SELECTOR = [
  'html[lang]',
  'meta[content]',
  'title',
  'script[type="application/ld+json"]',
  '[itemprop]'
].join(', ')

const MEDIA_EXTENSION_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|mp4|m4v|mov|webm|mkv|avi)$/i
const BY_RE = /^\s*by\s+|@\s*/i
const LOCATION_RE = /^[A-Z\s]+\s+[-—–]\s+/
const TITLE_SEPARATOR_RE = /[-|]\s+/

type Attrs = Record<string, string>
type Element = { tag: string; attrs: Attrs }
type Json = unknown
type Budget = { nodes: number }

const clip = (value: string) => (value.length > VALUE_CAP ? value.slice(0, VALUE_CAP) : value)
const condense = (value: string) => value.replace(/\s+/g, ' ').trim()
const clean = (value: string | undefined) => (value ? condense(decodeHTML(value)) : '')

const attrsOf = (el: HTMLRewriterTypes.Element): Attrs => {
  const attrs: Attrs = {}
  for (const [name, value] of el.attributes) attrs[name.toLowerCase()] = clip(value)
  return attrs
}

/** JSON-LD script text, under the script and char caps. One per HTMLRewriter pass. */
const jsonLdCapture = () => {
  const scripts: string[] = []
  let script: string | undefined
  let chars = 0
  return {
    scripts,
    /** For a `script[type="application/ld+json"]` that can have content. */
    open: (el: HTMLRewriterTypes.Element) => {
      if (scripts.length >= JSON_LD_SCRIPTS) return
      script = ''
      el.onEndTag(() => {
        if (script !== undefined) scripts.push(script)
        script = undefined
      })
    },
    text: (chunk: string) => {
      if (script !== undefined && chars < JSON_LD_CAP) {
        script += chunk
        chars += chunk.length
      }
    }
  }
}

/**
 * One pass over the head with one element handler and one document-level text handler.
 * `readPage` cuts at `</head`, so a `<title>` the cut left open settles at the end.
 */
const collect = (html: string) => {
  const elements: Element[] = []
  const counts = new Map<string, number>()
  const jsonLd = jsonLdCapture()
  let title: string | undefined
  let titleBuffer: string | undefined
  let htmlLang: string | undefined

  const keep = (tag: string, attrs: Attrs) => {
    const count = counts.get(tag) ?? 0
    if (count >= ELEMENT_CAP) return
    counts.set(tag, count + 1)
    elements.push({ tag, attrs })
  }
  // The first non-empty title, as metascraper's `$filter` reads it.
  const settleTitle = () => {
    if (title === undefined && titleBuffer !== undefined && condense(titleBuffer)) {
      title = titleBuffer
    }
    titleBuffer = undefined
  }

  const onElement = (el: HTMLRewriterTypes.Element) => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'html') htmlLang ??= el.getAttribute('lang') ?? undefined
    if (tag === 'meta') keep('meta', attrsOf(el))
    if (el.hasAttribute('itemprop')) keep('itemprop', attrsOf(el))
    // onEndTag throws on a tag with no end tag, such as `<title/>` inside `<svg>`.
    if (!el.canHaveContent) return
    if (tag === 'title' && title === undefined) {
      titleBuffer = ''
      el.onEndTag(settleTitle)
    }
    if (tag === 'script' && el.getAttribute('type') === 'application/ld+json') jsonLd.open(el)
  }

  new HTMLRewriter()
    .onDocument({
      text: (chunk) => {
        if (titleBuffer !== undefined && titleBuffer.length < VALUE_CAP) {
          titleBuffer = clip(titleBuffer + chunk.text)
        }
        jsonLd.text(chunk.text)
      }
    })
    .on(ELEMENT_SELECTOR, { element: onElement })
    .transform(html)

  settleTitle()
  return { elements, title, jsonLd: jsonLd.scripts, htmlLang }
}

/** Each script's parsed value, top-level arrays included. Bad JSON is skipped. */
const parseRoots = (scripts: string[]): Json[] =>
  scripts.flatMap((text) => {
    try {
      return [JSON.parse(text) as Json]
    } catch {
      return []
    }
  })

/**
 * metascraper's `$jsonld` collection: `@graph` items flattened with the outer props. Items and
 * copied outer keys are capped, because the copy multiplies one by the other.
 */
const jsonLdItems = (roots: Json[]): Json[] =>
  roots.flatMap((json) => {
    if (!json || typeof json !== 'object') return []
    const { '@graph': graph, ...rest } = json as Record<string, Json>
    const props = Object.fromEntries(Object.entries(rest).slice(0, OUTER_KEYS))
    if (Array.isArray(graph)) {
      return graph.slice(0, GRAPH_ITEMS).map((item) => ({ ...props, ...(item as object) }))
    }
    return [graph ? props : json]
  })

const getPath = (data: Json, path: string[]): Json => {
  let current = data
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, Json>)[key]
  }
  return current
}

const isEmptyValue = (value: Json) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)

/** The schema search metascraper falls back to, bounded in depth and by one budget per scrape. */
const searchSchema = (
  data: Json,
  props: string[],
  exact: boolean,
  budget: Budget,
  depth = 0
): string[] => {
  if (depth > SEARCH_DEPTH || --budget.nodes < 0 || data === null || data === undefined) return []
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return props.length === 0 ? [String(data)] : []
  }
  if (Array.isArray(data)) {
    if (
      props.length === 0 &&
      data.every((item) => typeof item === 'string' || typeof item === 'number')
    ) {
      return data.map(String)
    }
    return data.flatMap((item) => searchSchema(item, props, exact, budget, depth + 1))
  }
  const record = data as Record<string, Json>
  const [current, ...rest] = props
  if (!current) return typeof record.name === 'string' ? [record.name] : []
  if (Object.prototype.hasOwnProperty.call(record, current)) {
    const found = searchSchema(record[current], rest, exact, budget, depth + 1)
    if (found.length > 0) return found
  }
  if (exact) return []
  return Object.keys(record)
    .filter((key) => !key.startsWith('@'))
    .flatMap((key) => searchSchema(record[key], props, false, budget, depth + 1))
}

const jsonLdValue = (items: Json[], path: string, budget: Budget): Json => {
  const props = path.split('.')
  let value: Json
  let fallback: Json
  for (const item of items) {
    value = getPath(item, props)
    if (!isEmptyValue(value)) break
    if (value !== null && value !== undefined) continue
    if (fallback !== undefined || budget.nodes <= 0) continue
    const exact = searchSchema(item, props, true, budget)
    if (exact.length > 0) fallback = exact.length > 1 ? exact.join(' and ') : exact[0]
    else fallback = searchSchema(item, props, false, budget)[0]
  }
  if (value === null || value === undefined) value = fallback
  return typeof value === 'string' ? clip(value) : value
}

const resolveUrl = (value: string | undefined, base: string): string | undefined => {
  const raw = clean(value)
  if (!raw) return undefined
  try {
    const url = new URL(raw, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (MEDIA_EXTENSION_RE.test(url.pathname)) return undefined
    // Tracking parameters never reach our image relay; metascraper's URL cleaner dropped them too.
    for (const key of [...url.searchParams.keys()])
      if (/^utm_/i.test(key)) url.searchParams.delete(key)
    return url.href
  } catch {
    return undefined
  }
}

const toTitle = (value: string | undefined) => clean(value) || undefined

const toDescription = (value: string | undefined) => {
  let text = clean(value)
  if (!text) return undefined
  const points = [...text]
  if (points.length > DESCRIPTION_MAX)
    text = `${points.slice(0, DESCRIPTION_MAX).join('').trimEnd()}…`
  return text.replace(LOCATION_RE, '') || undefined
}

const toAuthor = (value: string | undefined) => {
  const text = clean(value)
  if (!text || text.length > AUTHOR_MAX || /^(https?:)?\/\//i.test(text)) return undefined
  return condense(text.replace(BY_RE, '')) || undefined
}

const toDate = (value: string | undefined) => {
  const text = clean(value)
  if (!text) return undefined
  const time = /^\d{4}$/.test(text) ? Date.parse(`${text}-01-01`) : Date.parse(text)
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

const toLang = (value: string | undefined) => {
  const code = clean(value).toLowerCase()
  return /^[a-z]{2}(?![a-z])/.test(code) ? code.slice(0, 2) : undefined
}

/** The part after the last "-" or "|" separator: what metascraper's title loop returned. */
const publisherFromTitle = (title: string | undefined) => {
  const parts = clean(title).split(TITLE_SEPARATOR_RE)
  return parts.length > 1 ? parts[parts.length - 1] || undefined : undefined
}

const first = <T>(...candidates: Array<() => T | undefined>): T | undefined => {
  for (const candidate of candidates) {
    const value = candidate()
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * The first element of each kind and attribute value. `property` and `name` match without case,
 * as browsers read them. Many sites write `name="og:image"`, so a `name` og tag fills a missing
 * `property` one, and a real `property` tag still wins wherever it sits.
 */
const indexElements = (elements: Element[]) => {
  const index = new Map<string, Attrs>()
  const put = (key: string, attrs: Attrs) => {
    if (!index.has(key)) index.set(key, attrs)
  }
  for (const el of elements) {
    for (const attr of ['property', 'name', 'itemprop'] as const) {
      const value = el.attrs[attr]
      if (value !== undefined)
        put(`${el.tag}|${attr}|${attr === 'itemprop' ? value : value.toLowerCase()}`, el.attrs)
    }
  }
  for (const el of elements) {
    const name = el.attrs.name?.toLowerCase()
    if (name?.startsWith('og:')) put(`${el.tag}|property|${name}`, el.attrs)
  }
  return index
}

/**
 * The html stage's page parser. It reads metascraper's head and JSON-LD rules in metascraper's
 * order, in one HTMLRewriter pass. `jobFacts` reads the body for JobPosting facts only; no other
 * body rule runs (h1 titles, page images, logos, bylines), so the card fields stay head-only.
 */
export const createHeadScraper = (): Scraper => ({
  scrape: async ({ html, url }) => {
    const { elements, title: titleText, jsonLd, htmlLang } = collect(html)
    const roots = parseRoots(jsonLd)
    const items = jsonLdItems(roots)
    const index = indexElements(elements)
    const budget: Budget = { nodes: SEARCH_NODES }

    const jsonLdText = (path: string): string | undefined => {
      const value = jsonLdValue(items, path, budget)
      return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
    }
    const meta = (attr: string, value: string) => index.get(`meta|${attr}|${value}`)?.content
    const metaLike = (attr: string, part: string) =>
      elements.find((el) => el.tag === 'meta' && el.attrs[attr]?.toLowerCase().includes(part))
        ?.attrs.content
    const itemprop = (part: string, read: string, exact = false) =>
      elements.find((el) => {
        const name = el.attrs.itemprop?.toLowerCase()
        return (
          el.tag === 'itemprop' &&
          name !== undefined &&
          (exact ? name === part : name.includes(part))
        )
      })?.attrs[read]
    const both = (key: string) => meta('name', key) ?? meta('property', key)
    const squareLogo = (path: string) => {
      const logo = jsonLdValue(items, path, budget) as Record<string, Json> | undefined
      if (!logo || typeof logo !== 'object') return undefined
      return logo.width && logo.height && logo.width === logo.height && typeof logo.url === 'string'
        ? logo.url
        : undefined
    }

    const title = first(
      () => toTitle(meta('property', 'og:title')),
      () => toTitle(meta('name', 'twitter:title')),
      () => toTitle(meta('property', 'twitter:title')),
      () => toTitle(titleText),
      () => toTitle(jsonLdText('headline'))
    )

    const description = first(
      () => toDescription(meta('property', 'og:description')),
      () => toDescription(meta('name', 'twitter:description')),
      () => toDescription(meta('property', 'twitter:description')),
      () => toDescription(meta('name', 'description')),
      () => toDescription(meta('itemprop', 'description')),
      () => toDescription(jsonLdText('articleBody')),
      () => toDescription(jsonLdText('description'))
    )

    const image = first(
      () => resolveUrl(meta('property', 'og:image:secure_url'), url),
      () => resolveUrl(meta('property', 'og:image:url'), url),
      () => resolveUrl(meta('property', 'og:image'), url),
      () => resolveUrl(meta('name', 'twitter:image:src'), url),
      () => resolveUrl(meta('property', 'twitter:image:src'), url),
      () => resolveUrl(meta('name', 'twitter:image'), url),
      () => resolveUrl(meta('property', 'twitter:image'), url),
      () => resolveUrl(meta('itemprop', 'image'), url),
      () => resolveUrl(jsonLdText('image.0.url'), url),
      () => resolveUrl(jsonLdText('image.url'), url),
      () => resolveUrl(jsonLdText('image'), url)
    )

    const logo = first(
      () => resolveUrl(meta('property', 'og:logo'), url),
      () => resolveUrl(meta('itemprop', 'logo'), url),
      ...[
        'brand.logo',
        'organization.logo',
        'place.logo',
        'product.logo',
        'service.logo',
        'publisher.logo',
        'logo.url',
        'logo'
      ].map((path) => () => resolveUrl(squareLogo(path), url))
    )

    const author = first(
      () => toAuthor(jsonLdText('author.name')),
      () => toAuthor(jsonLdText('brand.name')),
      () => toAuthor(meta('name', 'author')),
      () => toAuthor(meta('property', 'article:author'))
    )

    const publisher = first(
      () => toTitle(jsonLdText('publisher.name')),
      () => toTitle(meta('property', 'og:site_name')),
      () => toTitle(metaLike('name', 'application-name')),
      () => toTitle(metaLike('name', 'app-title')),
      () => toTitle(metaLike('property', 'app_name')),
      () => toTitle(meta('name', 'publisher')),
      () => toTitle(both('twitter:app:name:iphone')),
      () => toTitle(both('twitter:app:name:ipad')),
      () => toTitle(both('twitter:app:name:googleplay')),
      () => publisherFromTitle(titleText)
    )

    const date = first(
      () => toDate(jsonLdText('dateModified')),
      () => toDate(metaLike('property', 'modified_time')),
      () => toDate(itemprop('datemodified', 'content')),
      () => toDate(jsonLdText('datePublished')),
      () => toDate(jsonLdText('dateCreated')),
      () => toDate(metaLike('property', 'published_time')),
      () => toDate(itemprop('datepublished', 'content', true)),
      () => toDate(itemprop('datepublished', 'title', true)),
      () => toDate(meta('name', 'date')),
      () => toDate(itemprop('date', 'content')),
      () => toDate(itemprop('date', 'title'))
    )

    const lang = first(
      () => toLang(meta('property', 'og:locale')),
      () => toLang(meta('itemprop', 'inLanguage')),
      () => toLang(htmlLang)
    )

    const facts = jobPostingFacts(roots, new Date())

    return { title, description, image, logo, author, publisher, date, lang, facts }
  },

  // The one rule that reads past `</head`, with one narrow selector.
  jobFacts: (body) => {
    const jsonLd = jsonLdCapture()
    new HTMLRewriter()
      .on('script[type="application/ld+json"]', {
        element: (el) => {
          if (el.canHaveContent) jsonLd.open(el)
        },
        text: (chunk) => jsonLd.text(chunk.text)
      })
      .transform(body)
    return jobPostingFacts(parseRoots(jsonLd.scripts), new Date())
  }
})
