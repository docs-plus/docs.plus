/**
 * A plain object, never an array. Arrays pass `typeof value === 'object'`, and
 * two of the three copies this replaced let them through, so the name lied.
 * Every caller here walks stored JSON, where an array is a child list rather
 * than a node, and must not be read as one.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
