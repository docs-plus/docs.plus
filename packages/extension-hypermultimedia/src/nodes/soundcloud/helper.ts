export const SOUNDCLOUD_URL_REGEX =
  /^(https?:\/\/)?(www\.)?soundcloud\.com\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*(\/sets)?(\/[A-Za-z0-9_\-]+)?(\/?)?(\?[A-Za-z0-9_\-=&]+)?$/;
export const SOUNDCLOUD_URL_REGEX_GLOBAL =
  /^(https?:\/\/)?(www\.)?soundcloud\.com\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*(\/sets)?(\/[A-Za-z0-9_\-]+)?(\/?)?(\?[A-Za-z0-9_\-=&]+)?$/g;

export const isValidSoundCloudUrl = (url: string): boolean => {
  return SOUNDCLOUD_URL_REGEX.test(url);
};

// https://developers.soundcloud.com/docs/api/html5-widget
export interface GetSoundCloudEmbedUrlOptions {
  url: string;
  auto_play?: boolean; // Play track automatically
  // showComments?: boolean; // deprecated
  // show_reposts?: boolean; // deprecated
  // show_teaser?: boolean; // deprecated
  // show_comments?: boolean; // deprecated
  hide_related?: boolean; // Hide related tracks in the visual player
  visual?: boolean; // set to true for a video player, false for audio player
  color?: string; // hex code, Color play button and other controls. e.g. “#0066CC”
  buying?: boolean; // Show/Hide buy buttons
  sharing?: boolean; // Show/Hide share buttons
  download?: boolean; // Show/Hide download buttons
  show_artwork?: boolean; // Show/Hide the item’s artwork
  show_playcount?: boolean; // Show/Hide the item’s playcount
  show_user?: boolean; // Show/Hide the uploader’s name
  start_track?: number; // A number from 0 to the playlist length which reselects the track in a playlist
  single_active?: boolean; // If set to false the multiple players on the page won’t toggle each other off when playing
}

export const getSoundCloudEmbedUrl = (options: GetSoundCloudEmbedUrlOptions): string => {
  const embedUrl = new URL("https://w.soundcloud.com/player/");

  Object.entries(options).forEach(([key, value]) => {
    if (value) {
      if (typeof value === "boolean") {
        embedUrl.searchParams.append(key, value ? "true" : "false");
      } else if (typeof value === "number") {
        embedUrl.searchParams.append(key, value.toString());
      } else {
        embedUrl.searchParams.append(key, value);
      }
    }
  });

  return embedUrl.toString();
};
