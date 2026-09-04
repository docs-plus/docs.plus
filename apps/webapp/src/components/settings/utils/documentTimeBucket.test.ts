import { documentTimeBucket } from './documentTimeBucket'

const noon = (isoDate: string) => new Date(`${isoDate}T12:00:00`)

describe('documentTimeBucket', () => {
  const now = noon('2026-09-04')

  it('uses Today for the same local day', () => {
    expect(documentTimeBucket('2026-09-04T01:00:00', now)).toBe('today')
  })

  it('uses Yesterday for the previous local day', () => {
    expect(documentTimeBucket('2026-09-03T23:00:00', now)).toBe('yesterday')
  })

  it('uses Previous 7 days for two through six days ago', () => {
    expect(documentTimeBucket('2026-08-29T12:00:00', now)).toBe('week')
  })

  it('uses Previous 30 days for seven through 29 days ago', () => {
    expect(documentTimeBucket('2026-08-10T12:00:00', now)).toBe('month')
  })

  it('uses Earlier for 30 or more days ago', () => {
    expect(documentTimeBucket('2026-08-05T12:00:00', now)).toBe('earlier')
  })

  it('uses Never opened for a missing or invalid instant', () => {
    expect(documentTimeBucket(null, now)).toBe('never')
    expect(documentTimeBucket('not-a-date', now)).toBe('never')
  })
})
