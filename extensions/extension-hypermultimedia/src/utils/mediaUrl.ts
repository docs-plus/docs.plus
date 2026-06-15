// File-extension matchers for raw video/audio URLs. No `g` flag: a sticky
// lastIndex would make repeat `.test()` calls flaky. These back `detectMediaType`
// but not `isMediaUrl` — pasted `.mp4`/`.mp3` URLs stay links (see isMediaUrl).
const videoUrlRegex =
  /^(?:(?:https?|ftp):\/\/(?:www\.)?[^/]+\/|\/|\.\.?\/)?[\w\-/\\]+\.(mp4|avi|mov|wmv|flv|mkv|3gp|3g2|asf|divx|m4v|mpg|m2v|m4p|mts|m2ts|ogv|rm|rmvb|ts|vob|webm|qt|f4v)$/i

const audioUrlRegex =
  /^(?:(?:https?|ftp):\/\/(?:www\.)?[^/]+\/|\/|\.\.?\/)?[\w\-/\\]+\.(mp3|wav|aac|flac|ogg|m4a|aiff|ape|asf|m4p|m4b|mp2|mpc|wma|webm|opus|ra|rm|wavpack|wv)$/i

export const isVideoUrl = (url: string): boolean => videoUrlRegex.test(url)

export const isAudioUrl = (url: string): boolean => audioUrlRegex.test(url)
