export const VIMEO_REGEX = /https?:\/\/(www\.)?vimeo\.com\/\d{9}(?:$|\/|\?)/;
export const VIMEO_REGEX_GLOBAL = /https?:\/\/(www\.)?vimeo\.com\/\d{9}(?:$|\/|\?)/g;

export const isValidVimeoUrl = (url: string): boolean => {
  return VIMEO_REGEX.test(url);
};

export const getVimeoVideoId = (url: string): string | null => {
  const matches = url.match(/vimeo\.com\/(\d{9})/);
  return matches ? matches[1] : null;
};

export const getViemoVideoDetails = async (videoId: string): Promise<any> => {
  let data;
  try {
    const response = await fetch(`https://vimeo.com/api/oembed.json?url=${videoId}`);
    data = await response.json();
  } catch (error) {
    console.error(error);
  }

  return data;
};

export interface GetEmbedUrlOptions {
  url: string;
  height?: number;
  width?: number;
  title?: boolean;
  autopause?: boolean;
  autoplay?: boolean;
  background?: boolean;
  byline?: boolean | "site-default";
  color?: string;
  controls?: boolean;
  dnt?: boolean;
  keyboard?: boolean;
  loop?: boolean;
  muted?: boolean;
  pip?: boolean;
  playsinline?: boolean;
  portrait?: boolean | "site-default";
  quality?: "240p" | "360p" | "540p" | "720p" | "1080p" | "2k" | "4k" | "auto";
  speed?: boolean;
  startTime?: string;
  texttrack?: string | false;
}

export const getEmbedUrlFromVimeoUrl = (options: GetEmbedUrlOptions): string | null => {
  // Destructure the URL and other necessary properties from options
  const { url, title, height, width, ...restOptions } = options;

  if (!url) return null;

  // Check if it's already an embed URL
  if (url.includes("/video/")) {
    return url;
  }

  // Extract video ID from the URL
  const videoIdRegex = /vimeo\.com\/(\d+)/gm;
  const matches = videoIdRegex.exec(url);

  if (!matches || !matches[1]) {
    return null;
  }

  // Create a new URL object for the Vimeo embed URL
  const embedUrl = new URL(`https://player.vimeo.com/video/${matches[1]}`);

  // Process rest of the options and append them to the URL's search params
  Object.entries(restOptions).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // Check for undefined or null values
      if (typeof value === "boolean") {
        embedUrl.searchParams.append(key, value ? "1" : "0");
      } else if (typeof value === "number" || typeof value === "string") {
        embedUrl.searchParams.append(key, value.toString());
      }
    }
  });

  // Handle the title, height, and width separately as they are not part of restOptions
  if (title === false) {
    embedUrl.searchParams.append("title", "0");
  }
  if (height) {
    embedUrl.searchParams.append("height", height.toString());
  }
  if (width) {
    embedUrl.searchParams.append("width", width.toString());
  }

  return embedUrl.toString();
};
