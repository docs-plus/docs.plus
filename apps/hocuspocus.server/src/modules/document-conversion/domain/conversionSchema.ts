import { Hyperlink } from '@docs.plus/extension-hyperlink'
import { type Extensions, getSchema } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import type { Schema } from '@tiptap/pm/model'

import { migrationExtensions } from '../../../lib/migration-extensions'

// The migration set declares `hyperlink` and `highlight` as attribute-only
// stubs with no `toDOM`, so DOMSerializer silently drops every link and every
// highlight. Conversion is the only path that serializes, so it swaps in the
// real extensions instead of editing the shared storage set.
const STUB_MARKS = new Set(['hyperlink', 'highlight'])

const renderExtensions: Extensions = [
  ...migrationExtensions.filter((extension) => !STUB_MARKS.has(extension.name)),
  Hyperlink,
  Highlight
]

// StarterKit's `link` and Hyperlink both claim `a[href]` and neither declares a
// priority, so StarterKit wins and imported links land on a mark the editor
// cannot edit. Storage keeps `link` — stored documents still contain it.
const parseExtensions: Extensions = renderExtensions.map((extension) =>
  extension.name === 'starterKit' ? extension.configure({ link: false }) : extension
)

// Built lazily: the module must have no top-level side effects. Nodes are bound
// to the schema that made them, so these two and `encodeContent`'s validation
// schema only ever hand each other JSON — never a live `PMNode`.
let renderSchema: Schema | null = null
let parseSchema: Schema | null = null

export const getRenderSchema = (): Schema => (renderSchema ??= getSchema(renderExtensions))

export const getParseSchema = (): Schema => (parseSchema ??= getSchema(parseExtensions))
