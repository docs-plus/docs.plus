export const YOUTUBE_REGEX =
  /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be)(?!.*\/channel\/)(?!\/@)(.+)?$/;
export const YOUTUBE_REGEX_GLOBAL =
  /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be)(?!.*\/channel\/)(?!\/@)(.+)?$/g;

export const isValidYoutubeUrl = (url: string) => {
  return url.match(YOUTUBE_REGEX);
};

export interface GetEmbedUrlOptions {
  url: string;
  autoplay: 0 | 1;
  ccLanguage?: string;
  ccLoadPolicy?: 0 | 1;
  controls: 0 | 1;
  disableKBcontrols: 0 | 1;
  enableIFrameApi: 0 | 1;
  endTime?: number;
  interfaceLanguage?: string;
  ivLoadPolicy: 1 | 3;
  loop: 0 | 1;
  nocookie?: boolean;
  origin?: string;
  playlist?: string;
}

export const getYoutubeEmbedUrl = (nocookie?: boolean) => {
  return nocookie ? "https://www.youtube-nocookie.com/embed/" : "https://www.youtube.com/embed/";
};

const getVideoIdFromUrl = (url: string): string | undefined | null => {
  if (url.includes("/embed/")) {
    return url.split("/").pop();
  }

  if (url.includes("youtu.be")) {
    return url.split("/").pop();
  }

  const videoIdRegex = /v=([-\w]+)/;
  const matches = videoIdRegex.exec(url);
  return matches ? matches[1] : null;
};

export const getEmbedUrlFromYoutubeUrl = (options: GetEmbedUrlOptions): string | null => {
  const { url, nocookie, ...restOptions } = options;
  const videoId = getVideoIdFromUrl(url);

  if (!videoId) {
    return null;
  }

  const embedUrl = new URL(`${getYoutubeEmbedUrl(nocookie)}${videoId}`);

  Object.entries(restOptions).forEach(([key, value]) => {
    if (value || value === 0) {
      if (typeof value === "boolean") {
        embedUrl.searchParams.append(key, value ? "1" : "0");
      } else if (typeof value === "number" || typeof value === "string") {
        embedUrl.searchParams.append(key, value.toString());
      }
    }
  });

  return embedUrl.toString();
};
