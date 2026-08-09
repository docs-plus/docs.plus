import { detectMediaType } from './detectMediaType'

/**
 * True if `url` is one this kit auto-converts to a media node on paste.
 * A host running a link extension alongside it should veto these so media
 * URLs become nodes, not links: `Hyperlink.configure({ shouldAutoLink: (url)
 * => !isMediaUrl(url) })`. Resolves the paste precedence between the two.
 */
export const isMediaUrl = (url: string): boolean => {
  const kind = detectMediaType(url)
  // Raw video/audio URLs are excluded on purpose so pasted `.mp4`/`.mp3` stay links.
  return kind !== null && kind !== 'video' && kind !== 'audio'
}
