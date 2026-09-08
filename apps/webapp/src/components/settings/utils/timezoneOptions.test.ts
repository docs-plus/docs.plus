import {
  formatTimeDisplay,
  formatTimezoneLabel,
  getTimezoneOffset,
  getTimezoneSearchText
} from './timezoneOptions'

describe('formatTimezoneLabel', () => {
  it('puts the country alias in front of the zone path', () => {
    expect(formatTimezoneLabel('Europe/Rome')).toBe('Italy (Europe/Rome)')
  })

  it('keeps the zone path alone when the alias repeats the city', () => {
    expect(formatTimezoneLabel('Asia/Singapore')).toBe('Asia/Singapore')
  })

  it('reads the first name of a multi-name alias', () => {
    expect(formatTimezoneLabel('America/New_York')).toBe('USA Eastern (America/New York)')
  })

  it('falls back to the zone path with spaces when no alias exists', () => {
    expect(formatTimezoneLabel('America/Port_of_Spain')).toBe('America/Port of Spain')
  })
})

// Both zones stay off daylight saving, so the expected text cannot drift with
// the date the suite runs on.
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

describe('getTimezoneSearchText', () => {
  it('joins the zone path, the spaced path and the alias in lower case', () => {
    expect(getTimezoneSearchText('America/New_York')).toBe(
      'america/new_york america/new york usa eastern, new york'
    )
  })

  it('omits the alias part when the zone has none', () => {
    expect(getTimezoneSearchText('Africa/Accra')).toBe('africa/accra africa/accra')
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
