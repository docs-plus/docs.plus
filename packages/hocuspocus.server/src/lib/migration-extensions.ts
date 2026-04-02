/**
 * Minimal TipTap extensions for schema migration (JSON ↔ Yjs).
 *
 * Must stay in parity with the editor (`TipTap.tsx`): any node/mark that can
 * appear in stored Yjs must be registered here or migration encode fails.
 */

import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { Mark, Node } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { StarterKit } from '@tiptap/starter-kit'

const MigrationHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'toc-id': { default: null }
    }
  }
})

/** Matches `MediaUploadPlaceholder` in webapp (upload-in-progress atom). */
const MediaUploadPlaceholderNode = Node.create({
  name: 'mediaUploadPlaceholder',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      progress: { default: 0 },
      fileName: { default: '' },
      fileType: { default: 'image' },
      uploadId: { default: '' },
      localUrl: { default: null },
      width: { default: null },
      height: { default: null }
    }
  }
})

const Hyperlink = Mark.create({
  name: 'hyperlink',
  addAttributes() {
    return { href: { default: null }, target: { default: null } }
  }
})

const Highlight = Mark.create({
  name: 'highlight',
  addAttributes() {
    return { color: { default: null } }
  }
})

export const migrationExtensions = [
  StarterKit.configure({ heading: false }),
  MigrationHeading,
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  InlineCode,
  Superscript,
  Subscript,
  HyperMultimediaKit.configure({
    Image: true,
    Video: true,
    Audio: true,
    Youtube: true,
    Vimeo: true,
    SoundCloud: true,
    Twitter: true
  }),
  MediaUploadPlaceholderNode,
  Hyperlink,
  Highlight
]
