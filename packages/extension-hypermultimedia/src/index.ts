export * from "./utils/media-placement";

export * from "./hyperMultimediaKit";

export * from "./modals/image";

export * from "./modals/youtube";

export * from "./modals/twitter";

import { HyperMultimediaKit } from "./hyperMultimediaKit";

import { imageModal } from "./modals/image";

import { youtubeModal } from "./modals/youtube";

import { twitterModal } from "./modals/twitter";

export const vimeoModal = youtubeModal;

export const soundCloudModal = youtubeModal;

export const videoModal = youtubeModal;

export const audioModal = twitterModal;

export default {
  HyperMultimediaKit,
  imageModal,
  youtubeModal,
  twitterModal,
};
