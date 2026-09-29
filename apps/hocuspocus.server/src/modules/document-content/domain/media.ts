// Matched without the `/api` prefix: the webapp builds file links from its REST base URL.
const MEDIA_PATH = '/plugins/hypermultimedia/'

/** A link to the media route is a file attachment: deleting its text deletes the file. */
export const isMediaHref = (href: unknown): boolean =>
  typeof href === 'string' && href.includes(MEDIA_PATH)
