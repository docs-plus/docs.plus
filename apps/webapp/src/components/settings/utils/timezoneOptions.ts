export const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
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

export const formatTimezoneLabel = (tz: string): string => {
  const alias = TIMEZONE_ALIASES[tz]
  const cityName = tz.replace(/_/g, ' ')

  if (alias) {
    const primaryAlias = alias.split(',')[0].trim()
    // Avoid duplication if alias is same as city
    if (cityName.includes(primaryAlias)) {
      return cityName
    }
    return `${primaryAlias} (${cityName})`
  }
  return cityName
}

export const getTimezoneSearchText = (tz: string): string => {
  const parts = [tz, tz.replace(/_/g, ' ')]
  const alias = TIMEZONE_ALIASES[tz]
  if (alias) {
    parts.push(alias)
  }
  return parts.join(' ').toLowerCase()
}

// Read once per call: the offset text is DST-sensitive, so a frozen module
// constant would go stale.
export const buildTimezoneOptions = (): {
  value: string
  label: string
  description: string
  searchText: string
}[] =>
  ALL_TIMEZONES.map((tz) => ({
    value: tz,
    label: formatTimezoneLabel(tz),
    description: `${getTimezoneOffset(tz)}${TIMEZONE_ALIASES[tz] ? ` · ${TIMEZONE_ALIASES[tz]}` : ''}`,
    searchText: getTimezoneSearchText(tz)
  }))
