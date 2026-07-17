import {
  CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX,
  CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_PX,
  CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_SINGLE_PX,
  CHAT_MEDIA_FEED_MAX_WIDTH_MOBILE_PX,
  CHAT_MEDIA_FEED_MAX_WIDTH_PX,
  clampFeedColumnWidth,
  resolveFeedLayoutOptions
} from './feedAlbumLayout'

describe('resolveFeedLayoutOptions', () => {
  it('uses desktop width/height caps', () => {
    expect(resolveFeedLayoutOptions('desktop', 9)).toMatchObject({
      widthCap: CHAT_MEDIA_FEED_MAX_WIDTH_PX,
      maxHeight: CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX
    })
  })

  it('uses a taller mobile height for a single visual', () => {
    expect(resolveFeedLayoutOptions('mobile', 1).maxHeight).toBe(
      CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_SINGLE_PX
    )
    expect(resolveFeedLayoutOptions('mobile', 1).widthCap).toBe(CHAT_MEDIA_FEED_MAX_WIDTH_MOBILE_PX)
  })

  it('uses the mosaic mobile height for multi-visual albums', () => {
    expect(resolveFeedLayoutOptions('mobile', 5).maxHeight).toBe(
      CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_PX
    )
  })
})

describe('clampFeedColumnWidth', () => {
  it('clamps to the width cap and floors at 160', () => {
    expect(clampFeedColumnWidth(900, 560)).toBe(560)
    expect(clampFeedColumnWidth(40, 560)).toBe(160)
    expect(clampFeedColumnWidth(351.7, 560)).toBe(351)
  })
})
