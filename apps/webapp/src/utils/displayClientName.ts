const CLIENT_NAME_MAX = 80

/** An OAuth client picks its own name, and directional overrides can make it read as another app. */
export function displayClientName(name: string): string {
  const clean = name.replace(/[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, '').trim()
  if (!clean) return 'Unnamed app'
  return clean.length > CLIENT_NAME_MAX ? `${clean.slice(0, CLIENT_NAME_MAX)}…` : clean
}
