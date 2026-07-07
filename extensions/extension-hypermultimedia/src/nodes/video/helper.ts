// ![video](http://example.com/path-to-video.mp4 width=640 height=480)
// ![video](http://example.com/path-to-video.mp4)
// No `g` flag — input rules reuse the regex across keystrokes and a sticky lastIndex makes matches flaky.
export const inputRegex = /(?:^|\s)(!\[video]\((\S+)(?:\s+width=(\d+))?(?:\s+height=(\d+))?\))$/
