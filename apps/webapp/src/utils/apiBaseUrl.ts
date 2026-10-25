export const apiBaseUrl = (): string => {
  const base = process.env.NEXT_PUBLIC_RESTAPI_URL
  if (!base) throw new Error('NEXT_PUBLIC_RESTAPI_URL is not configured')
  return base
}
