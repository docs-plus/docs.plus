// Narrowing helpers for message metadata, which Supabase types as the wide `Json`.

export function getMetadataProperty<T = unknown>(
  metadata: unknown,
  property: string
): T | undefined {
  if (!metadata || typeof metadata !== 'object' || metadata === null) {
    return undefined
  }

  if (property in metadata) {
    return (metadata as Record<string, T>)[property]
  }

  return undefined
}

export function hasMetadataProperty(metadata: unknown, property: string): boolean {
  const value = getMetadataProperty(metadata, property)
  return Boolean(value)
}

export function getMetadataValue<T>(metadata: unknown, property: string, defaultValue: T): T {
  const value = getMetadataProperty<T>(metadata, property)
  return value !== undefined ? value : defaultValue
}
