import { apiBaseUrl } from './apiBaseUrl'

export const iconRouteUrl = (origin: string): string =>
  `${apiBaseUrl()}/metadata/icon?origin=${encodeURIComponent(origin)}`
