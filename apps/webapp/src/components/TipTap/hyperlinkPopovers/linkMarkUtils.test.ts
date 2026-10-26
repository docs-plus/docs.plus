/// <reference types="jest" />

import { previewIconCandidates } from './linkMarkUtils'

const API = 'https://api.example/api'
const route = (origin: string) => `${API}/metadata/icon?origin=${encodeURIComponent(origin)}`

describe('previewIconCandidates', () => {
  const saved = process.env.NEXT_PUBLIC_RESTAPI_URL
  beforeAll(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = API
  })
  afterAll(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = saved
  })

  it('tries the icon route, then the page icon, then the publisher logo, and never a share card', () => {
    const data = {
      icon: 'https://github.githubassets.com/favicon.svg',
      publisher: { logo: 'https://github.githubassets.com/logo.png' },
      image: { url: 'https://opengraph.githubassets.com/card.png' },
      oembed: { thumbnail: 'https://i.ytimg.com/vi/x/hqdefault.jpg' }
    }
    expect(
      previewIconCandidates(data as never, 'https://github.com/docs-plus/docs.plus/pull/1')
    ).toEqual([
      route('https://github.com'),
      'https://github.githubassets.com/favicon.svg',
      'https://github.githubassets.com/logo.png'
    ])
  })

  it('gives a mailto: link no candidate, so the popover draws its glyph', () => {
    expect(
      previewIconCandidates({ icon: 'data:image/svg+xml,x' } as never, 'mailto:a@b.c')
    ).toEqual([])
  })
})
