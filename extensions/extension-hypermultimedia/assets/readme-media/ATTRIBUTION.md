# README gallery media

Files in this folder are served by the clean-room playground (`--readme-media-dir ./assets/readme-media` → `/readme-media/*`) for Cypress README screenshots only. They are not shipped in the npm tarball (`package.json` `files` lists `dist` only).

| File         | Source                                                                                                                                                         | License                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `sample.png` | [Wikimedia Commons — PNG transparency demonstration](https://commons.wikimedia.org/wiki/File:PNG_transparency_demonstration_1.png)                             | Public domain                                             |
| `sample.mp4` | [Google Cloud Storage — gtv-videos-bucket sample `ForBiggerBlazes.mp4`](https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4) | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| `sample.ogg` | [Wikimedia Commons — Example.ogg](https://commons.wikimedia.org/wiki/File:Example.ogg)                                                                         | CC BY-SA 3.0                                              |

Embed screenshots (YouTube, Vimeo, SoundCloud, Loom, X) load public provider URLs at capture time; see `cypress/docs/readmeMedia.ts`.
