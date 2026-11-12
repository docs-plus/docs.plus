// The #726 bench fixture. bench-content-write.ts and bench-mcp-session.ts both build it,
// so a local run and a session run with one seed write the same text. A change to the
// word list, the sizes or the order of rand() calls breaks that comparison.
export const PARAGRAPH_CHARS = 350
const PARAGRAPHS_PER_SECTION = 20

export const mulberry32 = (start: number) => {
  let a = start
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WORDS = (
  'the document section heading change review editor version history people write share ' +
  'team plan notes meeting project draft update chat reply link table list quote code'
).split(' ')

export const sentence = (rand: () => number, chars: number) => {
  let out = ''
  while (out.length < chars) out += `${WORDS[Math.floor(rand() * WORDS.length)]} `
  return out.trim()
}

const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }]
})

export const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }]
})

/** `sections` keeps the text too, because the MCP session seeds it as Markdown. */
export const buildFixture = (rand: () => number, targetBytes: number) => {
  const content: object[] = [heading(1, 'Bench document')]
  const sections: { title: string; paragraphs: string[] }[] = []
  let textBytes = 0
  while (textBytes < targetBytes) {
    const title = `Section ${sections.length + 1}`
    content.push(heading(2, title))
    const paragraphs: string[] = []
    for (let p = 0; p < PARAGRAPHS_PER_SECTION; p++) {
      const text = sentence(rand, PARAGRAPH_CHARS)
      content.push(paragraph(text))
      paragraphs.push(text)
      textBytes += text.length
    }
    sections.push({ title, paragraphs })
  }
  return { doc: { type: 'doc', content }, sections }
}
