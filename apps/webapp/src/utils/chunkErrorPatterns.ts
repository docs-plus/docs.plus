/**
 * Deploy-boundary chunk/module load-failure messages. Shared by the recovery
 * listener (reload once) and the error-report filter (drop as auto-recovered)
 * so the two never drift — a new pattern must recover AND stay out of reporting.
 */
export const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk \d+ failed/i,
  /Loading JS chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i
]

export const matchesChunkError = (message: string): boolean =>
  CHUNK_ERROR_PATTERNS.some((re) => re.test(message))
