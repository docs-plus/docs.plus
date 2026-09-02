import { describe, expect, test } from 'bun:test'

import { encodeContent } from '../../../document-content/domain/encodeContent'
import { importMarkdown } from '../../domain/markdownImport'
import type { TiptapDocJson } from '../../types'

const types = (content: Record<string, unknown>[]) => content.map((node) => node.type)

const encode = (content: TiptapDocJson) => encodeContent(content, { requireTitleHeading: true })

describe('promoteImportedMedia via importMarkdown', () => {
  test('promotes a lone video file link to a video node', () => {
    const { content } = importMarkdown(
      '# Probe\n\n[/demo-assets/demo-video.mp4](/demo-assets/demo-video.mp4)\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'video'])
    expect((content.content[1] as { attrs: { src: string } }).attrs.src).toBe(
      '/demo-assets/demo-video.mp4'
    )
    expect(encode(content).ok).toBe(true)
  })

  test('promotes a lone audio file link to an audio node', () => {
    const { content } = importMarkdown(
      '# Probe\n\n[/demo-assets/demo-audio.mp3](/demo-assets/demo-audio.mp3)\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'audio'])
    expect(encode(content).ok).toBe(true)
  })

  test.each([
    ['youtube', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'],
    ['vimeo', 'https://vimeo.com/76979871'],
    ['loom', 'https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002'],
    ['soundcloud', 'https://soundcloud.com/forss/flickermood'],
    ['spotify', 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl'],
    ['x', 'https://x.com/jack/status/20']
  ] as const)('promotes a lone %s autolink', (kind, href) => {
    const { content } = importMarkdown(`# Probe\n\n<${href}>\n`, 'Fallback')

    expect(types(content.content)).toEqual(['heading', kind])
    expect((content.content[1] as { attrs: { src: string } }).attrs.src).toBe(href)
    expect(encode(content).ok).toBe(true)
  })

  test('lifts a typed block embed out of its paragraph', () => {
    const { content } = importMarkdown(
      '# Probe\n\n![youtube](https://www.youtube.com/watch?v=aqz-KE-bpKQ)\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'youtube'])
    expect(encode(content).ok).toBe(true)
  })

  test('leaves a filter link as a link', () => {
    const { content } = importMarkdown(
      '# Probe\n\n- [👋 Start here](/demo/start%20here)\n',
      'Fallback'
    )

    const list = content.content[1] as Record<string, any>
    const text = list.content[0].content[0].content[0]
    expect(text.marks[0].type).toBe('link')
    expect(text.marks[0].attrs.href).toBe('/demo/start%20here')
    expect(encode(content).ok).toBe(true)
  })

  test('leaves a labeled media link as a link', () => {
    const { content } = importMarkdown(
      '# Probe\n\n[Watch this](https://www.youtube.com/watch?v=aqz-KE-bpKQ)\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'paragraph'])
    const text = (content.content[1] as Record<string, any>).content[0]
    expect(text.marks[0].type).toBe('link')
    expect(encode(content).ok).toBe(true)
  })

  test('keeps an image and its italic line in one paragraph', () => {
    const { content } = importMarkdown(
      '# Probe\n\n![Three headings](/demo-assets/d1-idea.png)\n_The chatroom sits beside the passage._\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'paragraph'])
    const para = content.content[1] as Record<string, any>
    expect(para.content[0].type).toBe('image')
    expect(para.content[0].attrs.src).toBe('/demo-assets/d1-idea.png')
    expect(para.content[0].attrs.width).toBeUndefined()
    expect(para.content.some((child: { text?: string }) => child.text?.includes('chatroom'))).toBe(
      true
    )
    expect(encode(content).ok).toBe(true)
  })

  test('does not promote a video link inside a list item', () => {
    const { content } = importMarkdown(
      '# Probe\n\n- [/demo-assets/demo-video.mp4](/demo-assets/demo-video.mp4)\n',
      'Fallback'
    )

    const list = content.content[1] as Record<string, any>
    expect(list.type).toBe('bulletList')
    expect(list.content[0].content[0].type).toBe('paragraph')
    expect(list.content[0].content[0].content[0].marks[0].type).toBe('link')
    expect(encode(content).ok).toBe(true)
  })

  test('leaves text plus a media URL as a link', () => {
    const { content } = importMarkdown(
      '# Probe\n\nSee <https://www.youtube.com/watch?v=aqz-KE-bpKQ>\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'paragraph'])
    const para = content.content[1] as Record<string, any>
    expect(
      para.content.some(
        (child: { marks?: { type: string }[] }) => child.marks?.[0]?.type === 'link'
      )
    ).toBe(true)
    expect(para.content.some((child: { type?: string }) => child.type === 'youtube')).toBe(false)
    expect(encode(content).ok).toBe(true)
  })

  test('lifts a typed embed inside a blockquote', () => {
    const { content } = importMarkdown(
      '# Probe\n\n> ![youtube](https://www.youtube.com/watch?v=aqz-KE-bpKQ)\n',
      'Fallback'
    )

    const quote = content.content[1] as Record<string, any>
    expect(quote.type).toBe('blockquote')
    expect(types(quote.content)).toEqual(['youtube'])
    expect(encode(content).ok).toBe(true)
  })

  test('still promotes a media URL when the same file has a picture', () => {
    const { content } = importMarkdown(
      '# Probe\n\n![alt](/demo-assets/d0-intro.png)\n\n[/demo-assets/demo-video.mp4](/demo-assets/demo-video.mp4)\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'paragraph', 'video'])
    expect(encode(content).ok).toBe(true)
  })

  test('synthesizes a title when the file opens on a media URL', () => {
    const { content, warnings } = importMarkdown(
      '<https://www.youtube.com/watch?v=aqz-KE-bpKQ>\n',
      'Demo'
    )

    expect(types(content.content)).toEqual(['heading', 'youtube'])
    expect(warnings.some((warning) => warning.code === 'title-synthesized')).toBe(true)
    expect(encode(content).ok).toBe(true)
  })
})
