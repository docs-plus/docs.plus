// ![video](http://example.com/path-to-video.mp4 width=640 height=480)
// ![video](http://example.com/path-to-video.mp4)
export const inputRegex = /(?:^|\s)(!\[video]\((\S+)(?:\s+width=(\d+))?(?:\s+height=(\d+))?\))$/g
