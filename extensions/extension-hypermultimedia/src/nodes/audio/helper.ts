// ![audio](http://example.com/path-to-audio.mp3 width=640 height=480)
// ![audio](http://example.com/path-to-audio.mp3)
// No `g` flag — input rules reuse the regex across keystrokes and a sticky lastIndex makes matches flaky.
export const inputRegex = /(?:^|\s)(!\[audio]\((\S+)(?:\s+width=(\d+))?(?:\s+height=(\d+))?\))$/
