/**
 * Utility functions for safely accessing message metadata
 * Handles Supabase Json type safely
 */

/**
 * Safely gets a property from metadata object
 */
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

/**
 * Safely checks if metadata has a boolean property
 */
export function hasMetadataProperty(metadata: unknown, property: string): boolean {
  const value = getMetadataProperty(metadata, property)
  return Boolean(value)
}

/**
 * Type-safe metadata accessor with default value
 */
export function getMetadataValue<T>(
  metadata: unknown,
  property: string,
  defaultValue: T
): T {
  const value = getMetadataProperty<T>(metadata, property)
  return value !== undefined ? value : defaultValue
}

