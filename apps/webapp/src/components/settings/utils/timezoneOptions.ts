export const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/** This engine's spelling of a zone: V8 says `Asia/Calcutta` where Firefox and Safari say `Asia/Kolkata`. */
export const canonicalTimezone = (tz: string): string => {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone
  } catch {
    return tz
  }
}

// `Intl.supportedValuesOf` is missing on older browsers, so fall back to a
// short list of common zones.
const getAllTimezones = (): string[] => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Sao_Paulo',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Moscow',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Singapore',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Australia/Sydney',
      'Pacific/Auckland'
    ]
  }
}

const ALL_TIMEZONES = getAllTimezones()

// Friendly names for common timezones (searchable aliases)
const TIMEZONE_ALIASES: Record<string, string> = {
  'Asia/Dubai': 'UAE, United Arab Emirates',
  'Asia/Riyadh': 'Saudi Arabia',
  'Asia/Qatar': 'Qatar',
  'Asia/Kuwait': 'Kuwait',
  'Asia/Bahrain': 'Bahrain',
  'Asia/Muscat': 'Oman',
  'Asia/Tehran': 'Iran',
  'Asia/Jerusalem': 'Israel',
  'Asia/Amman': 'Jordan',
  'Asia/Beirut': 'Lebanon',
  'Asia/Kolkata': 'India',
  'Asia/Shanghai': 'China',
  'Asia/Tokyo': 'Japan',
  'Asia/Seoul': 'South Korea',
  'Asia/Singapore': 'Singapore',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Bangkok': 'Thailand',
  'Asia/Jakarta': 'Indonesia',
  'Asia/Manila': 'Philippines',
  'Asia/Kuala_Lumpur': 'Malaysia',
  'Asia/Karachi': 'Pakistan',
  'Asia/Dhaka': 'Bangladesh',
  'Asia/Ho_Chi_Minh': 'Vietnam',
  'Europe/London': 'UK, United Kingdom, Britain',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'Europe/Rome': 'Italy',
  'Europe/Madrid': 'Spain',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Brussels': 'Belgium',
  'Europe/Zurich': 'Switzerland',
  'Europe/Vienna': 'Austria',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Warsaw': 'Poland',
  'Europe/Prague': 'Czech Republic',
  'Europe/Athens': 'Greece',
  'Europe/Istanbul': 'Turkey',
  'Europe/Moscow': 'Russia',
  'Europe/Dublin': 'Ireland',
  'Europe/Lisbon': 'Portugal',
  'America/New_York': 'USA Eastern, New York',
  'America/Chicago': 'USA Central, Chicago',
  'America/Denver': 'USA Mountain, Denver',
  'America/Los_Angeles': 'USA Pacific, California',
  'America/Toronto': 'Canada Eastern',
  'America/Vancouver': 'Canada Pacific',
  'America/Mexico_City': 'Mexico',
  'America/Sao_Paulo': 'Brazil',
  'America/Buenos_Aires': 'Argentina',
  'America/Lima': 'Peru',
  'America/Bogota': 'Colombia',
  'America/Santiago': 'Chile',
  'Africa/Cairo': 'Egypt',
  'Africa/Lagos': 'Nigeria',
  'Africa/Johannesburg': 'South Africa',
  'Africa/Nairobi': 'Kenya',
  'Africa/Casablanca': 'Morocco',
  'Australia/Sydney': 'Australia Eastern',
  'Australia/Melbourne': 'Australia, Melbourne',
  'Australia/Perth': 'Australia Western',
  'Pacific/Auckland': 'New Zealand'
}

// Re-key by this engine's spelling, so `india` also finds `Asia/Calcutta` in V8.
const ALIASES_BY_ZONE: Record<string, string> = Object.fromEntries(
  Object.entries(TIMEZONE_ALIASES).map(([tz, alias]) => [canonicalTimezone(tz), alias])
)

export const formatTimeDisplay = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export const TIME_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 48 },
  (_, i) => {
    const hours = String(Math.floor(i / 2)).padStart(2, '0')
    const minutes = i % 2 === 0 ? '00' : '30'
    const value = `${hours}:${minutes}`
    return { value, label: formatTimeDisplay(value) }
  }
)

export const getTimezoneOffset = (tz: string): string => {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    })
    const parts = formatter.formatToParts(now)
    return parts.find((p) => p.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

// `shortOffset` writes `GMT`, `GMT+9` or `GMT-3:30`; some ICU builds use U+2212 for the minus.
const GMT_OFFSET = /^GMT(?:([+\-\u2212])(\d{1,2})(?::(\d{2}))?)?$/

/** Minutes east of UTC; 0 when the text does not parse. */
const parseOffsetMinutes = (gmtOffset: string): number => {
  const match = GMT_OFFSET.exec(gmtOffset)
  if (!match?.[1]) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)
  return match[1] === '+' ? minutes : -minutes
}

const formatUtcOffset = (minutes: number): string => {
  const abs = Math.abs(minutes)
  const hours = String(Math.floor(abs / 60)).padStart(2, '0')
  return `UTC${minutes < 0 ? '-' : '+'}${hours}:${String(abs % 60).padStart(2, '0')}`
}

/** The last IANA segment: `America/Argentina/Buenos_Aires` reads `Buenos Aires`. */
const getTimezoneCity = (tz: string): string => (tz.split('/').pop() ?? tz).replace(/_/g, ' ')

// One `Intl` read per zone; every other part derives from it.
export const describeTimezone = (tz: string) => {
  const gmtOffset = getTimezoneOffset(tz)
  const minutes = parseOffsetMinutes(gmtOffset)
  const offset = formatUtcOffset(minutes)
  const city = getTimezoneCity(tz)
  const country = ALIASES_BY_ZONE[tz]?.split(',')[0].trim()
  return {
    minutes,
    offset,
    city,
    label: `(${offset}) ${city}`,
    // Skip an alias that only repeats the city, such as Singapore.
    country: country && country !== city ? country : undefined,
    searchText: [tz, city, ALIASES_BY_ZONE[tz], offset, gmtOffset]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }
}

// Read once per call: the offset text is DST-sensitive, so a frozen module
// constant would go stale.
export const buildTimezoneOptions = (): {
  value: string
  label: string
  description?: string
  searchText: string
}[] =>
  ALL_TIMEZONES.map((tz) => ({ value: tz, ...describeTimezone(tz) }))
    .sort((a, b) => a.minutes - b.minutes || a.city.localeCompare(b.city))
    .map(({ value, label, country, searchText }) => ({
      value,
      label,
      description: country,
      searchText
    }))
