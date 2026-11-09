/** Fixture URLs shared by the Markdown specs (paste-matrix parity). */
export const FIXTURES = {
  image: 'https://example.com/photo.png',
  audio: 'https://example.com/track.mp3',
  video: 'https://example.com/clip.mp4',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  vimeo: 'https://vimeo.com/123456789',
  soundcloud: 'https://soundcloud.com/forss/flickermood',
  spotify: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
  loom: 'https://www.loom.com/share/abcdef1234567890',
  x: 'https://x.com/jack/status/20'
} as const

export type MediaNode = keyof typeof FIXTURES
