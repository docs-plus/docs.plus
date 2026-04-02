/**
 * Minimal TipTap extension stubs for schema migration.
 *
 * TiptapTransformer.toYdoc() needs a PM schema that knows about every node/mark
 * type present in the document. These stubs cover custom types not in StarterKit.
 * Remove after all documents are migrated to the flat schema.
 */

import { Mark, Node } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { StarterKit } from '@tiptap/starter-kit'

const MigrationHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'toc-id': { default: null }
    }
  }
})

const ImageNode = Node.create({
  name: 'Image',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
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
  ImageNode,
  Hyperlink,
  Highlight
]
