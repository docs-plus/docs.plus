export const TWITTER_URL_REGEX =
  /^(https?:\/\/)?((www|mobile)\.)?x\.com\/[A-Za-z0-9_]{1,15}\/status\/[0-9]+\/?$/;

export const TWITTER_URL_REGEX_GLOBAL =
  /^(https?:\/\/)?((www|mobile)\.)?x\.com\/[A-Za-z0-9_]{1,15}\/status\/[0-9]+\/?$/;


export const isValidTwitterUrl = (url: string): boolean => {
  return TWITTER_URL_REGEX.test(url);
};

export const getTwitterIdFromUrl = (url: string): string => {
  const id = url.split("/").pop();

  if (!id) {
    throw new Error("Invalid Twitter URL");
  }

  return id;
};
export interface GetTwitterEmbedUrlOptions {
  src: string;
  id?: string; // Tweet ID
  theme?: "light" | "dark"; // Theme of the embedded Tweet
  width?: number | string; // Width of the embedded Tweet, e.g., 550 or '550px'
  height?: number | string; // Height of the embedded Tweet, e.g., 600 or '600px'
  dnt?: boolean; // Data tracking parameter
  lang?: string; // Language parameter, e.g., 'en' for English
  limit?: number; //	Display up to N items where N is a value between 1 and 20 inclusive
  maxwidth?: number; // Set the maximum width of the widget. Must be between 180 and 1200 inclusive
  maxheight?: number; // Set the maximum height of the widget. Must be greater than 200
  chrome?: "noheader" | "nofooter" | "noborders" | "noscrollbar" | "transparent" | string;
  aria_polite?: string; // Set an assertive ARIA live region politeness value for Tweets added to a timeline
}

export const getTwitterEmbedUrl = (options: GetTwitterEmbedUrlOptions): string => {
  const { src, ...otherOptions } = options;

  const tweetId = getTwitterIdFromUrl(src);
  const newUrl = new URL(`https://platform.twitter.com/embed/Tweet.html`);

  // Special handling for the tweet id which is derived from the url
  newUrl.searchParams.append("id", tweetId);

  Object.entries(otherOptions).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === "boolean") {
        newUrl.searchParams.append(key, value ? "true" : "false");
      } else if (typeof value === "number" || typeof value === "string") {
        newUrl.searchParams.append(key, value.toString());
      }
      // additional handling for other types if necessary
    }
  });

  return newUrl.toString();
};

declare global {
  interface Window {
    twttr: any; // Twitter widgets script
  }
}

export const loadTwitterScript = () => {
  if (window.twttr) {
    return Promise.resolve(window.twttr);
  }

  return new Promise((resolve, reject) => {
    // Check if the script already exists in the document
    const existingScript = document.querySelector(
      'script[src="https://platform.twitter.com/widgets.js"]'
    );

    if (existingScript) {
      // If the script is already loaded, resolve the promise
      // as soon as the twttr object becomes available
      const checkTwttr = setInterval(() => {
        if (window.twttr) {
          clearInterval(checkTwttr);
          resolve(window.twttr);
        }
      }, 200);
      return;
    }

    // If the script doesn't exist, create and append a new script element
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve(window.twttr);
    script.onerror = reject;
    document.head.append(script);
  });
};

export const fetchOEmbedHtml = async (params: Record<string, any>) => {
  // Build the query string from the params object
  const urlParams = new URLSearchParams(params);
  const urlWithParams = `https://publish.twitter.com/oembed?${urlParams.toString()}`;

  const response = await fetch(urlWithParams);

  if (!response.ok) {
    throw new Error("Failed to fetch oEmbed HTML");
  }

  const data = await response.json();
  return data.html;
};
