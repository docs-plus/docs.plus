import { describe, expect, test } from 'bun:test'

import { createHeadScraper } from '../../infra/headScraper'

const URL = 'https://example.com/post'
const scrape = (head: string, body = '') =>
  createHeadScraper().scrape({
    html: `<html lang="en"><head>${head}</head><body>${body}</body></html>`,
    url: URL
  })

describe('createHeadScraper', () => {
  test('follows metascraper rule order: og:title, then twitter:title, then <title>, then JSON-LD', async () => {
    expect((await scrape('<title>T</title><meta property="og:title" content="OG">')).title).toBe(
      'OG'
    )
    expect((await scrape('<title>T</title><meta name="twitter:title" content="TW">')).title).toBe(
      'TW'
    )
    expect((await scrape('<title>T</title>')).title).toBe('T')
    expect(
      (await scrape('<script type="application/ld+json">{"headline":"LD"}</script>')).title
    ).toBe('LD')
  })

  test('reads name="og:*" and any-case meta names; a property tag still wins', async () => {
    expect((await scrape('<meta name="og:image" content="/n.png">')).image).toBe(
      'https://example.com/n.png'
    )
    const both =
      '<meta name="og:image" content="/n.png"><meta property="og:image" content="/p.png">'
    expect((await scrape(both)).image).toBe('https://example.com/p.png')
    expect((await scrape('<meta name="Description" content="D">')).description).toBe('D')
  })

  test('decodes entities in attributes, text and JSON-LD', async () => {
    const meta = await scrape(
      '<title>A &amp; B &#8211; C</title><meta property="og:description" content="x &quot;y&quot; &eacute;">'
    )
    expect(meta.title).toBe('A & B – C')
    expect(meta.description).toBe('x "y" é')
    const ld = await scrape('<script type="application/ld+json">{"headline":"H &amp; J"}</script>')
    expect(ld.title).toBe('H & J')
  })

  test('resolves the page image, drops tracking parameters, refuses media and other schemes', async () => {
    expect(
      (await scrape('<meta property="og:image" content="/a.png?utm_source=x&amp;w=2">')).image
    ).toBe('https://example.com/a.png?w=2')
    expect(
      (await scrape('<meta property="og:image" content="data:image/png;base64,AA">')).image
    ).toBeUndefined()
    expect(
      (await scrape('<meta property="og:image" content="https://cdn.example.com/v.mp4">')).image
    ).toBeUndefined()
  })

  test('cuts a long description at 300 code points without splitting an emoji', async () => {
    const description = `${'a'.repeat(299)}😀${'b'.repeat(50)}`
    const meta = await scrape(`<meta name="description" content="${description}">`)
    expect(meta.description).toBe(`${'a'.repeat(299)}😀…`)
  })

  test('reads no body rule', async () => {
    // The read stops at </head, so a body rule would only see what the network sent first.
    const meta = await scrape(
      '',
      '<h1 class="title">Body</h1><img src="/b.png"><time datetime="2020">'
    )
    expect(meta).toMatchObject({ title: undefined, image: undefined, date: undefined })
  })

  test('a title the head cut left open still counts', async () => {
    const meta = await createHeadScraper().scrape({ html: '<html><head><title>Cut off', url: URL })
    expect(meta.title).toBe('Cut off')
  })

  test('caps a crafted title before any text work', async () => {
    const meta = await scrape(`<title>${'- '.repeat(32 * 1024)}x</title>`)
    expect(meta.title?.length).toBeLessThanOrEqual(4096)
  })

  test('flattens a JSON-LD @graph and skips malformed JSON', async () => {
    const meta = await scrape(
      '<script type="application/ld+json">{oops</script>' +
        '<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"author":{"name":"Ada Lovelace"}}]}</script>'
    )
    expect(meta.author).toBe('Ada Lovelace')
  })

  test('takes the publisher from the part after the last title separator', async () => {
    expect((await scrape('<title>Post title | Section - Example News</title>')).publisher).toBe(
      'Example News'
    )
  })
})
