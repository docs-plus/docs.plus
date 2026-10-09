import { pickLinkedHeading } from './pickLinkedHeading'

const base = { linkId: 'x1', channelHeadingId: null, isLiveHeading: false, documentId: 'doc1' }

describe('pickLinkedHeading', () => {
  it('opens the heading of a channel in this document', () => {
    expect(pickLinkedHeading({ ...base, channelHeadingId: 'h1', isLiveHeading: true })).toBe('h1')
  })

  it('opens a share link that carries a live heading id', () => {
    expect(pickLinkedHeading({ ...base, isLiveHeading: true })).toBe('x1')
  })

  it('opens the document chat by its documentId', () => {
    expect(pickLinkedHeading({ ...base, linkId: 'doc1' })).toBe('doc1')
  })

  it('opens nothing for a channel of another document', () => {
    expect(pickLinkedHeading(base)).toBeNull()
  })
})
