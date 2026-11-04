import { linkParts } from './linkParts'
import type { LinkMiss, NoPreviewView } from './types'

/** One sentence shape per kind: "<kind>. Open it to <verb> it." */
const FILE_KINDS: { kind: string; verb: string; extensions: string[] }[] = [
  { kind: 'A PDF file', verb: 'read', extensions: ['pdf'] },
  { kind: 'A document file', verb: 'read', extensions: ['doc', 'docx', 'odt', 'rtf'] },
  { kind: 'A spreadsheet file', verb: 'view', extensions: ['xls', 'xlsx', 'ods', 'csv'] },
  { kind: 'A presentation file', verb: 'view', extensions: ['ppt', 'pptx', 'odp'] },
  {
    kind: 'An archive file',
    verb: 'download',
    extensions: ['zip', 'tar', 'gz', 'tgz', 'rar', '7z']
  },
  {
    kind: 'An image file',
    verb: 'view',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tif', 'tiff', 'heic']
  },
  {
    kind: 'An audio file',
    verb: 'play',
    extensions: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus']
  },
  {
    kind: 'A video file',
    verb: 'play',
    extensions: ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', 'ogv']
  }
]

const FILE_REASON = new Map(
  FILE_KINDS.flatMap(({ kind, verb, extensions }) =>
    extensions.map((ext) => [ext, `${kind}. Open it to ${verb} it.`] as const)
  )
)

const MISS_REASON: Record<LinkMiss, string> = {
  blocked: 'This site does not share previews.',
  'no-preview': 'This page has no title or summary.',
  unreachable: 'The site did not answer. Try again soon.'
}

const GENERAL_REASON = 'This site shares no preview.'

/** A file names its kind by the last segment's extension, so `.html` or `.php` stays a page. */
const fileOf = (href: string): NoPreviewView | null => {
  const { host, path } = linkParts(href)
  const cut = path.lastIndexOf('/') + 1
  const name = path.slice(cut)
  const dot = name.lastIndexOf('.')
  const reason = dot > 0 ? FILE_REASON.get(name.slice(dot + 1).toLowerCase()) : undefined
  return reason ? { title: name, path: `${host}${path.slice(0, cut)}`, reason } : null
}

/** A file wins over any server reason, then `miss`, then the general line. */
export const noPreviewView = (href: string, miss?: LinkMiss): NoPreviewView => {
  const file = fileOf(href)
  if (file) return file
  const { host, path } = linkParts(href)
  return { title: host, path, reason: miss ? MISS_REASON[miss] : GENERAL_REASON }
}
