/**
 * Minimal TipTap extensions for schema migration (JSON ↔ Yjs).
 *
 * Must stay in parity with the editor (`TipTap.tsx`): any node/mark that can
 * appear in stored Yjs must be registered here or migration encode fails.
 */

import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { Extension, Mark, Node } from '@tiptap/core'
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

// Mirrors every attribute the webapp Hyperlink mark declares: ProseMirror drops
// unknown attrs on re-encode, so an absent stub silently strips stored values.
// `title`/`image` are the cached preview metadata writeLinkMetadataAttrs persists.
const Hyperlink = Mark.create({
  name: 'hyperlink',
  addAttributes() {
    return {
      href: { default: null },
      target: { default: null },
      rel: { default: null },
      class: { default: null },
      title: { default: null },
      image: { default: null }
    }
  }
})

/** Webapp-only stored attrs (ParagraphStyle's `paragraphStyle`, UniqueID's
 * `toc-id` on tables/hyperlink marks; heading's lives on MigrationHeading).
 * Registered so re-encode preserves stored values instead of restamping. */
const StoredWebappAttrs = Extension.create({
  name: 'migrationStoredWebappAttrs',
  addGlobalAttributes() {
    return [
      { types: ['paragraph'], attributes: { paragraphStyle: { default: null } } },
      { types: ['table', 'hyperlink'], attributes: { 'toc-id': { default: null } } }
    ]
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
    // Inline, matching the webapp (TipTap.tsx). Content expressions are only
    // evaluated by an explicit `.check()`, never by toYdoc/fromYdoc, so this is
    // byte-identical on every transform path — it exists so a schema built from
    // this set validates paragraph-wrapped images the way the editor does.
    Image: { inline: true },
    Video: true,
    Audio: true,
    Youtube: true,
    Vimeo: true,
    SoundCloud: true,
    Spotify: true,
    Loom: true,
    X: true
  }),
  MediaUploadPlaceholderNode,
  Hyperlink,
  Highlight,
  StoredWebappAttrs
]
