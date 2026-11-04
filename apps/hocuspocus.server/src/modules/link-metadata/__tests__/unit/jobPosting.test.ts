import { describe, expect, test } from 'bun:test'

import { jobPostingFacts } from '../../infra/jobPosting'

const NOW = new Date('2026-11-03T12:00:00Z')
const facts = (...roots: unknown[]) => jobPostingFacts(roots, NOW)
const job = (fields: Record<string, unknown>) => ({ '@type': 'JobPosting', ...fields })

describe('jobPostingFacts', () => {
  test('reads a remote Ashby posting: countries, type and date', () => {
    // Trimmed from jobs.ashbyhq.com/ramp on 2026-11-03.
    expect(
      facts(
        job({
          datePosted: '2026-04-07',
          employmentType: 'FULL_TIME',
          hiringOrganization: { '@type': 'Organization', name: 'Ramp' },
          jobLocation: { '@type': 'Place', address: { addressLocality: 'New York City' } },
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: [
            { '@type': 'Country', name: 'Canada' },
            { '@type': 'Country', name: 'United States' },
            { '@type': 'Country', name: 'USA' }
          ]
        })
      )
    ).toEqual([
      { icon: 'location', text: 'Remote, Canada +2' },
      { icon: 'work', text: 'Full-time' },
      { icon: 'posted', text: 'Posted Apr 7' }
    ])
  })

  test('reads an on-site LinkedIn posting: city and a country code as a name', () => {
    // Trimmed from linkedin.com/jobs/view on 2026-11-03.
    expect(
      facts(
        job({
          datePosted: '2026-09-02T16:57:09.000Z',
          employmentType: 'FULL_TIME',
          jobLocation: {
            '@type': 'Place',
            address: { addressCountry: 'DE', addressLocality: 'Berlin', addressRegion: null }
          }
        })
      )
    ).toEqual([
      { icon: 'location', text: 'Berlin, Germany' },
      { icon: 'work', text: 'Full-time' },
      { icon: 'posted', text: 'Posted Sep 2' }
    ])
  })

  test('picks one location rule', () => {
    const where = (fields: Record<string, unknown>) =>
      facts(job(fields))?.find((fact) => fact.icon === 'location')?.text
    expect(where({ jobLocationType: 'TELECOMMUTE' })).toBe('Remote')
    expect(
      where({ jobLocationType: ['TELECOMMUTE'], applicantLocationRequirements: { name: 'US' } })
    ).toBe('Remote, United States')
    expect(
      where({
        jobLocationType: 'telecommute',
        applicantLocationRequirements: [{ name: 'Canada' }, { name: 'Worldwide' }]
      })
    ).toBe('Remote, global')
    expect(where({ jobLocation: { address: { addressCountry: 'USA' } } })).toBe('USA')
    expect(
      where({
        jobLocation: [
          { address: { addressLocality: 'Lisbon', addressCountry: { name: 'Portugal' } } },
          { address: { addressLocality: 'Porto', addressCountry: 'PT' } }
        ]
      })
    ).toBe('Lisbon, Portugal +1')
    expect(where({ jobLocation: { address: 'Z&uuml;rich' } })).toBe('Zürich')
    // Lever's Singapore posting gave "Singapore, Singapore" on 2026-11-03.
    expect(
      where({ jobLocation: { address: { addressLocality: 'Singapore', addressCountry: 'SG' } } })
    ).toBe('Singapore')
  })

  test('maps employment types and falls back to the hiring organization', () => {
    const kind = (fields: Record<string, unknown>) =>
      facts(job(fields))?.find((fact) => fact.icon === 'work')?.text
    expect(kind({ employmentType: ['PART_TIME', 'CONTRACTOR', 'INTERN'] })).toBe(
      'Part-time, Contract'
    )
    expect(kind({ employmentType: 'FullTime' })).toBe('Full-time')
    expect(kind({ employmentType: 'OTHER', hiringOrganization: { name: 'Acme' } })).toBe('Acme')
    expect(kind({ hiringOrganization: 'Acme &amp; Co' })).toBe('Acme & Co')
  })

  test('adds the year for a date outside the current year', () => {
    expect(facts(job({ datePosted: '2025-10-31' }))).toEqual([
      { icon: 'posted', text: 'Posted Oct 31, 2025' }
    ])
    expect(facts(job({ datePosted: 'soon' }))).toBeUndefined()
  })

  test('finds the posting in @graph, a top-level array or a typed array', () => {
    const posting = { datePosted: '2026-10-31' }
    const expected = [{ icon: 'posted' as const, text: 'Posted Oct 31' }]
    expect(facts({ '@graph': [{ '@type': 'Organization' }, job(posting)] })).toEqual(expected)
    expect(facts([{ '@type': 'WebPage' }, job(posting)])).toEqual(expected)
    expect(facts({ '@type': ['Thing', 'JobPosting'], ...posting })).toEqual(expected)
  })

  test('skips non-object and non-job roots and reads the next one', () => {
    const posting = job({ datePosted: '2026-10-31' })
    expect(facts(null, 'JobPosting', { '@type': 'Article' }, posting)).toEqual([
      { icon: 'posted', text: 'Posted Oct 31' }
    ])
  })

  test('walks only the first items of a long list', () => {
    const many = Array.from({ length: 5_000 }, (_, i) => ({ name: `C${i}` }))
    expect(
      facts(job({ jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: many }))
    ).toEqual([{ icon: 'location', text: 'Remote, C0 +9' }])
  })
})
