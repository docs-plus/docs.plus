import {
  buildTimezoneOptions,
  canonicalTimezone,
  describeTimezone,
  formatTimeDisplay,
  getTimezoneOffset
} from './timezoneOptions'

// Exact labels use zones that stay off daylight saving, so the expected text
// cannot drift with the date the suite runs on.
describe('describeTimezone', () => {
  it('puts the padded UTC offset before the city', () => {
    expect(describeTimezone('Asia/Tokyo').label).toBe('(UTC+09:00) Tokyo')
    expect(describeTimezone('Asia/Kolkata').label).toBe('(UTC+05:30) Kolkata')
  })

  it('reads the city from the last zone segment, with spaces', () => {
    expect(describeTimezone('America/Argentina/Buenos_Aires').city).toBe('Buenos Aires')
  })

  it('reads plain GMT as a zero offset', () => {
    expect(describeTimezone('UTC').label).toBe('(UTC+00:00) UTC')
  })

  it('names the country, unless it repeats the city', () => {
    expect(describeTimezone('Asia/Tehran').country).toBe('Iran')
    expect(describeTimezone('Asia/Singapore').country).toBeUndefined()
  })

  it('finds a zone by city, country, zone id and offset text', () => {
    for (const query of ['tehran', 'iran', 'asia/tehran']) {
      expect(describeTimezone('Asia/Tehran').searchText).toContain(query)
    }
    expect(describeTimezone('Asia/Kolkata').searchText).toContain('+5:30')
    expect(describeTimezone('Asia/Kolkata').searchText).toContain('+05:30')
  })
})

// V8 lists `Asia/Calcutta`; Firefox and Safari list `Asia/Kolkata`.
describe('canonicalTimezone', () => {
  it('gives both spellings of a renamed zone the same id', () => {
    expect(canonicalTimezone('Asia/Kolkata')).toBe(canonicalTimezone('Asia/Calcutta'))
    expect(canonicalTimezone('Europe/Kyiv')).toBe(canonicalTimezone('Europe/Kiev'))
  })

  it('keeps an unknown zone as it is', () => {
    expect(canonicalTimezone('Not/AZone')).toBe('Not/AZone')
  })

  it('finds the country of a renamed zone in this engine', () => {
    const india = describeTimezone(canonicalTimezone('Asia/Kolkata'))
    expect(india.country).toBe('India')
    expect(india.searchText).toContain('india')
    expect(describeTimezone(canonicalTimezone('Asia/Ho_Chi_Minh')).country).toBe('Vietnam')
  })
})

describe('buildTimezoneOptions', () => {
  it('sorts by offset, then by city', () => {
    const zones = buildTimezoneOptions().map((option) => option.value)
    expect(zones.indexOf('Asia/Tehran')).toBeLessThan(zones.indexOf('Asia/Seoul'))
    expect(zones.indexOf('Asia/Seoul')).toBeLessThan(zones.indexOf('Asia/Tokyo'))
  })

  it('names India on the listed spelling of its zone', () => {
    const india = buildTimezoneOptions().find((option) => option.description === 'India')
    expect(india?.value).toBe(canonicalTimezone('Asia/Kolkata'))
  })
})

describe('getTimezoneOffset', () => {
  it('reads the short offset of a whole-hour zone', () => {
    expect(getTimezoneOffset('Asia/Tokyo')).toBe('GMT+9')
  })

  it('keeps the minutes of a half-hour zone', () => {
    expect(getTimezoneOffset('Asia/Kolkata')).toBe('GMT+5:30')
  })

  it('returns an empty string for an unknown zone', () => {
    expect(getTimezoneOffset('Not/AZone')).toBe('')
  })
})

describe('formatTimeDisplay', () => {
  it('shows midnight and noon as 12', () => {
    expect(formatTimeDisplay('00:00')).toBe('12:00 AM')
    expect(formatTimeDisplay('12:30')).toBe('12:30 PM')
  })

  it('drops the leading zero of an afternoon hour', () => {
    expect(formatTimeDisplay('13:00')).toBe('1:00 PM')
  })
})
