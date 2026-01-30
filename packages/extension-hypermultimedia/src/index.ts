export * from './hyperMultimediaKit'
export * from './modals/image'
export * from './modals/twitter'
export * from './modals/youtube'
export * from './utils/floating-toolbar'
export * from './utils/media-placement'

import { HyperMultimediaKit } from './hyperMultimediaKit'
import { imageModal } from './modals/image'
import { twitterModal } from './modals/twitter'
import { youtubeModal } from './modals/youtube'

export const vimeoModal = youtubeModal

export const soundCloudModal = youtubeModal

export const videoModal = youtubeModal

export const audioModal = twitterModal

export default {
  HyperMultimediaKit,
  imageModal,
  youtubeModal,
  twitterModal
}
