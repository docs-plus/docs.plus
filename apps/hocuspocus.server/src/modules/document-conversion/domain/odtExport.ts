import type { TiptapDocJson } from '../types'
import { isRecord } from '../types'
import { toPortableJson } from './portableJson'
import { createZip } from './zipWriter'

type JsonNode = Record<string, unknown>

const MIMETYPE = 'application/vnd.oasis.opendocument.text'
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'

const NAMESPACES = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"'
].join(' ')

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}

const SPACE = 0x20
const TAB = 0x09
const LINE_FEED = 0x0a
const CARRIAGE_RETURN = 0x0d

// XML 1.0 forbids control characters outright — not even a numeric entity is
// legal — so one pasted into a stored document makes the package unopenable.
const isXmlSafe = (code: number): boolean =>
  code >= SPACE || code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN

const escapeXml = (value: string): string => {
  let xml = ''
  for (const char of value) {
    if (!isXmlSafe(char.charCodeAt(0))) continue
    xml += XML_ESCAPES[char] ?? char
  }
  return xml
}

const childrenOf = (node: JsonNode): unknown[] => (Array.isArray(node.content) ? node.content : [])

const attrsOf = (node: JsonNode): Record<string, unknown> =>
  isRecord(node.attrs) ? node.attrs : {}

const MARK_STYLES: Record<string, string> = {
  bold: 'Strong_20_Emphasis',
  italic: 'Emphasis',
  code: 'Source_20_Text',
  inlineCode: 'Source_20_Text',
  strike: 'Strikethrough',
  underline: 'Underline',
  highlight: 'Highlight',
  superscript: 'Superscript',
  subscript: 'Subscript'
}

// Stored documents predate the Hyperlink mark, so StarterKit's `link` still
// appears in older snapshots and has to resolve to the same ODF anchor.
const LINK_MARKS = new Set(['hyperlink', 'link'])

const anchor = (href: string, body: string): string =>
  `<text:a xlink:type="simple" xlink:href="${escapeXml(href)}" text:style-name="Internet_20_link">${body}</text:a>`

const renderText = (node: JsonNode): string => {
  let xml = escapeXml(typeof node.text === 'string' ? node.text : '')
  let href = ''

  for (const mark of Array.isArray(node.marks) ? node.marks : []) {
    if (!isRecord(mark) || typeof mark.type !== 'string') continue
    if (LINK_MARKS.has(mark.type)) {
      const target = attrsOf(mark).href
      if (href.length === 0 && typeof target === 'string') href = target
      continue
    }
    const style = MARK_STYLES[mark.type]
    if (style) xml = `<text:span text:style-name="${style}">${xml}</text:span>`
  }

  return href.length > 0 ? anchor(href, xml) : xml
}

// ODF draws a picture through a sized frame. A remote image with no measured
// width would render as an empty box, so the reader gets a link it can follow.
const renderImage = (node: JsonNode): string => {
  const attrs = attrsOf(node)
  const src = typeof attrs.src === 'string' ? attrs.src : ''
  if (src.length === 0) return ''
  const alt = typeof attrs.alt === 'string' && attrs.alt.trim().length > 0 ? attrs.alt : src
  return anchor(src, escapeXml(alt))
}

const renderInline = (nodes: unknown[]): string => {
  let xml = ''
  for (const node of nodes) {
    if (!isRecord(node)) continue
    if (node.type === 'text') xml += renderText(node)
    else if (node.type === 'hardBreak') xml += '<text:line-break/>'
    else if (node.type === 'image') xml += renderImage(node)
    else if (Array.isArray(node.content)) xml += renderInline(node.content)
  }
  return xml
}

// ODF collapses runs of white space exactly like HTML, so code indentation only
// survives as explicit markers.
const preformatted = (line: string): string =>
  escapeXml(line)
    .replace(/\t/g, '<text:tab/>')
    .replace(/ +/g, (run: string, index: number) => {
      const leading = index === 0 ? '' : ' '
      const extra = run.length - leading.length
      return extra > 0 ? `${leading}<text:s text:c="${extra}"/>` : leading
    })

const MAX_HEADING_LEVEL = 6

const renderHeading = (node: JsonNode, prefix: string): string => {
  const raw = attrsOf(node).level
  const level =
    typeof raw === 'number' ? Math.min(Math.max(Math.trunc(raw), 1), MAX_HEADING_LEVEL) : 1
  return `<text:h text:style-name="Heading_20_${level}" text:outline-level="${level}">${prefix}${renderInline(childrenOf(node))}</text:h>`
}

const renderCodeBlock = (node: JsonNode): string => {
  const source = childrenOf(node)
    .map((child) => (isRecord(child) && typeof child.text === 'string' ? child.text : ''))
    .join('')

  return source
    .split('\n')
    .map((line) => {
      const body = preformatted(line)
      return body.length > 0
        ? `<text:p text:style-name="Preformatted_20_Text">${body}</text:p>`
        : '<text:p text:style-name="Preformatted_20_Text"/>'
    })
    .join('')
}

const CHECKED_BOX = '☑ '
const UNCHECKED_BOX = '☐ '

const renderListItem = (item: JsonNode): string => {
  const prefix =
    item.type === 'taskItem' ? (attrsOf(item).checked === true ? CHECKED_BOX : UNCHECKED_BOX) : ''
  const body = childrenOf(item)
    .map((child, index) =>
      isRecord(child) ? renderBlock(child, 'Standard', index === 0 ? prefix : '') : ''
    )
    .join('')
  const fallback = `<text:p text:style-name="Standard">${prefix}</text:p>`
  return `<text:list-item>${body || fallback}</text:list-item>`
}

const renderList = (node: JsonNode): string => {
  const style = node.type === 'orderedList' ? 'DocsNumberList' : 'DocsBulletList'
  const items = childrenOf(node)
    .map((item) => (isRecord(item) ? renderListItem(item) : ''))
    .join('')
  return items.length > 0 ? `<text:list text:style-name="${style}">${items}</text:list>` : ''
}

const COVERED_CELL = '<table:covered-table-cell/>'

// `encodeContent` validates content expressions, not attribute values, so a
// stored `colspan` is unbounded — and it drives both a `.repeat()` and a
// per-column loop below. Writer tops out at 64 columns and Word at 63, so no
// span past this is representable anyway; unclamped it re-allocates gigabytes.
const MAX_TABLE_SPAN = 64

const spanOf = (attrs: Record<string, unknown>, key: string): number => {
  const raw = attrs[key]
  return typeof raw === 'number' && raw > 1 ? Math.min(Math.trunc(raw), MAX_TABLE_SPAN) : 1
}

const renderCell = (cell: JsonNode, colspan: number, rowspan: number): string => {
  const style = cell.type === 'tableHeader' ? 'Table_20_Heading' : 'Standard'
  const spans =
    (colspan > 1 ? ` table:number-columns-spanned="${colspan}"` : '') +
    (rowspan > 1 ? ` table:number-rows-spanned="${rowspan}"` : '')
  const body = renderBlocks(childrenOf(cell), style) || `<text:p text:style-name="${style}"/>`
  return `<table:table-cell table:style-name="DocsTableCell" office:value-type="string"${spans}>${body}</table:table-cell>`
}

/**
 * A merged cell only reads back correctly if every grid position it covers
 * holds a `covered-table-cell`. `carry` tracks how many further rows each
 * column still owes one. The widest resulting row is the grid width.
 */
const renderRows = (rows: JsonNode[]): { xml: string; width: number } => {
  const carry: number[] = []
  let width = 0
  let xml = ''

  for (const row of rows) {
    let column = 0
    let cells = ''

    const drainCovered = (): void => {
      while ((carry[column] ?? 0) > 0) {
        cells += COVERED_CELL
        carry[column] -= 1
        column += 1
      }
    }

    for (const cell of childrenOf(row)) {
      if (!isRecord(cell)) continue
      drainCovered()
      const attrs = attrsOf(cell)
      const colspan = spanOf(attrs, 'colspan')
      const rowspan = spanOf(attrs, 'rowspan')
      cells += renderCell(cell, colspan, rowspan) + COVERED_CELL.repeat(colspan - 1)
      for (let index = 0; index < colspan; index += 1) carry[column + index] = rowspan - 1
      column += colspan
    }
    drainCovered()

    width = Math.max(width, column)
    xml += `<table:table-row>${cells}</table:table-row>`
  }

  return { xml, width }
}

// `table:name` must be unique per document. `exportOdt` renders synchronously
// with no await, so a module counter reset per call cannot interleave.
let tableCount = 0

const renderTable = (node: JsonNode): string => {
  const { xml, width } = renderRows(childrenOf(node).filter(isRecord))
  if (width === 0) return ''
  tableCount += 1
  return `<table:table table:name="Table${tableCount}" table:style-name="DocsTable"><table:table-column table:number-columns-repeated="${width}"/>${xml}</table:table>`
}

const renderBlock = (node: JsonNode, paragraphStyle: string, prefix = ''): string => {
  switch (node.type) {
    case 'heading':
      return renderHeading(node, prefix)
    case 'paragraph':
      return `<text:p text:style-name="${paragraphStyle}">${prefix}${renderInline(childrenOf(node))}</text:p>`
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return renderList(node)
    case 'blockquote':
      return renderBlocks(childrenOf(node), 'Quotations')
    case 'codeBlock':
      return renderCodeBlock(node)
    case 'horizontalRule':
      return '<text:p text:style-name="Horizontal_20_Line"/>'
    case 'table':
      return renderTable(node)
    default:
      // An unrecognised wrapper still carries readable children; a leaf atom does not.
      return Array.isArray(node.content) ? renderBlocks(node.content, paragraphStyle) : ''
  }
}

const renderBlocks = (nodes: unknown[], paragraphStyle: string): string =>
  nodes.map((node) => (isRecord(node) ? renderBlock(node, paragraphStyle) : '')).join('')

const HEADING_SIZES = ['130%', '115%', '101%', '95%', '85%', '75%']

const HEADING_STYLES = HEADING_SIZES.map((size, index) => {
  const level = index + 1
  return `<style:style style:name="Heading_20_${level}" style:display-name="Heading ${level}" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="${level}"><style:paragraph-properties fo:margin-top="0.42cm" fo:margin-bottom="0.21cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="${size}" fo:font-weight="bold"/></style:style>`
}).join('')

const LIST_LEVELS = 10

const listStyle = (name: string, level: (depth: number, indent: string) => string): string => {
  const levels = Array.from({ length: LIST_LEVELS }, (_, index) =>
    level(index + 1, `${((index + 1) * 0.635).toFixed(3)}cm`)
  ).join('')
  return `<text:list-style style:name="${name}">${levels}</text:list-style>`
}

const LIST_STYLES =
  listStyle(
    'DocsBulletList',
    (depth, indent) =>
      `<text:list-level-style-bullet text:level="${depth}" text:bullet-char="•"><style:list-level-properties text:space-before="${indent}" text:min-label-width="0.635cm"/></text:list-level-style-bullet>`
  ) +
  listStyle(
    'DocsNumberList',
    (depth, indent) =>
      `<text:list-level-style-number text:level="${depth}" style:num-suffix="." style:num-format="1"><style:list-level-properties text:space-before="${indent}" text:min-label-width="0.635cm"/></text:list-level-style-number>`
  )

const MONOSPACE = "'Liberation Mono', monospace"

const TEXT_STYLES = [
  `<style:style style:name="Strong_20_Emphasis" style:display-name="Strong Emphasis" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>`,
  `<style:style style:name="Emphasis" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>`,
  `<style:style style:name="Source_20_Text" style:display-name="Source Text" style:family="text"><style:text-properties fo:font-family="${MONOSPACE}"/></style:style>`,
  `<style:style style:name="Strikethrough" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style>`,
  `<style:style style:name="Underline" style:family="text"><style:text-properties style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/></style:style>`,
  `<style:style style:name="Highlight" style:family="text"><style:text-properties fo:background-color="#ffff00"/></style:style>`,
  `<style:style style:name="Superscript" style:family="text"><style:text-properties style:text-position="super 58%"/></style:style>`,
  `<style:style style:name="Subscript" style:family="text"><style:text-properties style:text-position="sub 58%"/></style:style>`,
  `<style:style style:name="Internet_20_link" style:display-name="Internet link" style:family="text"><style:text-properties fo:color="#0000ee" style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/></style:style>`
].join('')

const PARAGRAPH_STYLES = [
  `<style:style style:name="Standard" style:family="paragraph" style:class="text"/>`,
  HEADING_STYLES,
  `<style:style style:name="Preformatted_20_Text" style:display-name="Preformatted Text" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm"/><style:text-properties fo:font-family="${MONOSPACE}" fo:font-size="10pt"/></style:style>`,
  `<style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1cm" fo:margin-top="0.25cm" fo:margin-bottom="0.25cm"/></style:style>`,
  `<style:style style:name="Horizontal_20_Line" style:display-name="Horizontal Line" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.5cm" fo:border-bottom="0.06pt solid #808080" fo:padding="0cm"/><style:text-properties fo:font-size="6pt"/></style:style>`,
  `<style:style style:name="Table_20_Heading" style:display-name="Table Heading" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-weight="bold"/></style:style>`
].join('')

const TABLE_STYLES =
  `<style:style style:name="DocsTable" style:family="table"><style:table-properties style:width="17cm" table:align="margins"/></style:style>` +
  `<style:style style:name="DocsTableCell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #808080" fo:padding="0.1cm"/></style:style>`

// ODF fixes child order: styles, then automatic styles, then master styles.
const STYLES_XML = `${XML_DECLARATION}<office:document-styles ${NAMESPACES} office:version="1.3"><office:styles>${PARAGRAPH_STYLES}${TEXT_STYLES}${TABLE_STYLES}${LIST_STYLES}</office:styles><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21.001cm" fo:page-height="29.7cm" style:print-orientation="portrait" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`

const MANIFEST_XML = `${XML_DECLARATION}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="${MIMETYPE}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`

const metaXml = (title: string): string =>
  `${XML_DECLARATION}<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta><meta:generator>docs.plus</meta:generator><dc:title>${escapeXml(title)}</dc:title></office:meta></office:document-meta>`

const contentXml = (body: string): string =>
  `${XML_DECLARATION}<office:document-content ${NAMESPACES} office:version="1.3"><office:automatic-styles/><office:body><office:text>${body}</office:text></office:body></office:document-content>`

/**
 * `title` reaches the file through `dc:title` only — the document's first node
 * already is its title heading, so writing it into the body duplicates it.
 */
export const exportOdt = (doc: TiptapDocJson, title: string): Buffer => {
  tableCount = 0
  const body = renderBlocks(toPortableJson(doc).content ?? [], 'Standard')

  return createZip([
    { name: 'mimetype', data: MIMETYPE, store: true },
    { name: 'META-INF/manifest.xml', data: MANIFEST_XML },
    { name: 'content.xml', data: contentXml(body) },
    { name: 'styles.xml', data: STYLES_XML },
    { name: 'meta.xml', data: metaXml(title) }
  ])
}
