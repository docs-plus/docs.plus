import { Extension } from "@tiptap/core";
import { Image, ImageOptions } from "./nodes/image/image";
import { Youtube, YoutubeOptions } from "./nodes/youtube/youtube";
import { Vimeo, VimeoOptions } from "./nodes/vimeo/vimeo";
import { Twitter, TwitterOptions } from "./nodes/twitter/twitter";
import { SoundCloud, SoundCloudOptions } from "./nodes/soundcloud/soundcloud";
import { MediaResizeGripper } from "./extensions/resizeGripper";
import { Video, VideoOptions } from "./nodes/video/video";
import { Audio, AudioOptions } from "./nodes/audio/audio";

export interface HyperMultimediaKitOptions {
  Image: Partial<ImageOptions & { resizeGripper?: boolean }> | true | false;
  Audio: Partial<AudioOptions & { resizeGripper?: boolean }> | true | false;
  Video: Partial<VideoOptions & { resizeGripper?: boolean }> | true | false;
  Youtube: Partial<YoutubeOptions & { resizeGripper?: boolean }> | true | false;
  Vimeo: Partial<VimeoOptions & { resizeGripper?: boolean }> | true | false;
  SoundCloud: Partial<SoundCloudOptions & { resizeGripper?: boolean }> | true | false;
  Twitter: Partial<TwitterOptions> | true | false;
}

type MediaExtension =
  | typeof Image
  | typeof Video
  | typeof Audio
  | typeof Youtube
  | typeof Vimeo
  | typeof SoundCloud
  | typeof Twitter;

export const HyperMultimediaKit = Extension.create<HyperMultimediaKitOptions>({
  name: "HyperMultimediaKit",

  addExtensions() {
    const extensions = [];
    const resizableMedia: string[] = [];

    const addMediaExtension = (media: MediaExtension, mediaOptions: any) => {
      if (mediaOptions !== false) {
        extensions.push(media.configure(mediaOptions));

        if (mediaOptions?.resizeGripper !== false) {
          // By default, it's true
          resizableMedia.push(media.name);
        }
      }
    };

    addMediaExtension(Image, this.options.Image);
    addMediaExtension(Video, this.options.Video);
    addMediaExtension(Audio, this.options.Audio);
    addMediaExtension(Youtube, this.options.Youtube);
    addMediaExtension(Vimeo, this.options.Vimeo);
    addMediaExtension(SoundCloud, this.options.SoundCloud);
    addMediaExtension(Twitter, this.options.Twitter);

    if (resizableMedia.length > 0) {
      extensions.push(
        MediaResizeGripper.configure({
          acceptedNodes: resizableMedia,
        })
      );
    }

    return extensions;
  },
});
