import { decodeHTML } from 'entities'

import { factDate } from '../domain/facts'
import type { Fact } from '../domain/types'

// The list caps bound every array a crafted script can make us walk. The scraper caps the
// script text before parse.
const NODES_CAP = 50
const LIST_CAP = 10
const VALUE_CAP = 256

const GLOBAL_PLACE = /^(worldwide|anywhere|global|earth|world)$/i

const EMPLOYMENT: Record<string, string> = {
  FULLTIME: 'Full-time',
  PARTTIME: 'Part-time',
  CONTRACTOR: 'Contract',
  CONTRACT: 'Contract',
  TEMPORARY: 'Temporary',
  INTERN: 'Internship',
  INTERNSHIP: 'Internship',
  VOLUNTEER: 'Volunteer',
  PERDIEM: 'Per diem'
}

type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value.slice(0, LIST_CAP) : value === undefined ? [] : [value]

const str = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = decodeHTML(value.slice(0, VALUE_CAP)).replace(/\s+/g, ' ').trim()
  return text || undefined
}

/** A name given as a string or as `{ name }`. */
const nameOf = (value: unknown): string | undefined =>
  str(value) ?? (isNode(value) ? str(value.name) : undefined)

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

/** "DE" reads "Germany". Any other value, "USA" included, stays as written. */
const country = (value: unknown): string | undefined => {
  const name = nameOf(value)
  if (!name || !/^[A-Z]{2}$/.test(name)) return name
  try {
    return regionNames?.of(name) ?? name
  } catch {
    return name
  }
}

const isJobPosting = (node: Node): boolean =>
  list(node['@type']).some((type) => type === 'JobPosting')

/** Top-level nodes, top-level arrays and `@graph` items. No deeper walk, so nesting costs nothing. */
const findJobPosting = (roots: unknown[]): Node | undefined => {
  for (const json of roots) {
    const tops = Array.isArray(json) ? json.slice(0, NODES_CAP) : [json]
    for (const root of tops) {
      if (!isNode(root)) continue
      const nodes = Array.isArray(root['@graph']) ? root['@graph'].slice(0, NODES_CAP) : [root]
      const found = nodes.find((node): node is Node => isNode(node) && isJobPosting(node))
      if (found) return found
    }
  }
  return undefined
}

/** One name, or the first name and how many more. */
const firstAndMore = (names: string[]): string | undefined =>
  names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]

const placeName = (place: unknown): string | undefined => {
  if (!isNode(place)) return nameOf(place)
  const address = place.address
  if (!isNode(address)) return nameOf(address) ?? nameOf(place)
  const parts = [
    str(address.addressLocality) ?? str(address.addressRegion),
    country(address.addressCountry)
  ]
  // Singapore and Monaco are both city and country; say the name once.
  const named = parts.filter((part, i): part is string => !!part && part !== parts[i - 1])
  return named.join(', ') || nameOf(place)
}

/**
 * Remote jobs read "Remote", "Remote, global" or "Remote, Canada +2" from the countries an
 * applicant may live in. Other jobs read "City, Country" from the first place, plus a count.
 */
const location = (posting: Node): string | undefined => {
  const remote = list(posting.jobLocationType).some(
    (type) => typeof type === 'string' && type.toUpperCase() === 'TELECOMMUTE'
  )
  if (remote) {
    const names = [...new Set(list(posting.applicantLocationRequirements).map(country))].filter(
      (name): name is string => name !== undefined
    )
    if (names.some((name) => GLOBAL_PLACE.test(name))) return 'Remote, global'
    const where = firstAndMore(names)
    return where ? `Remote, ${where}` : 'Remote'
  }
  const places = list(posting.jobLocation)
    .map(placeName)
    .filter((name): name is string => name !== undefined)
  return firstAndMore([...new Set(places)])
}

/** "Full-time" and the like. With no type, the hiring organization's name. */
const work = (posting: Node): string | undefined => {
  const types = list(posting.employmentType)
    .map((type) =>
      typeof type === 'string' ? EMPLOYMENT[type.replace(/[^a-z]/gi, '').toUpperCase()] : undefined
    )
    .filter((type): type is string => type !== undefined)
  if (types.length > 0) return [...new Set(types)].slice(0, 2).join(', ')
  return nameOf(posting.hiringOrganization)
}

/** The facts of the first JobPosting in the parsed JSON-LD scripts of a head or a body. */
export const jobPostingFacts = (roots: unknown[], now: Date): Fact[] | undefined => {
  const posting = findJobPosting(roots)
  if (!posting) return undefined
  const facts: Fact[] = []
  const where = location(posting)
  if (where) facts.push({ icon: 'location', text: where })
  const kind = work(posting)
  if (kind) facts.push({ icon: 'work', text: kind })
  const posted = factDate(posting.datePosted, now)
  if (posted) facts.push({ icon: 'posted', text: `Posted ${posted}` })
  return facts.length > 0 ? facts : undefined
}
