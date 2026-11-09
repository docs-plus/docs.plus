# Media in Markdown

How to write a picture, a video, an audio file or an embed in Markdown, so docs.plus imports it as media. It also covers what a Markdown export writes for media. It does not cover the editor toolbar, and it does not cover the extension for developers. For that, see the [extension docs](../extensions/extension-hypermultimedia/docs/paste-and-import.md#markdown-importexport).

The syntax works wherever docs.plus reads Markdown:

- **Import** a `.md` file from the document settings, or through the [import route](../apps/hocuspocus.server/API.md#fidelity-contract).
- **Paste** Markdown into a pad. docs.plus reads it as Markdown only when the text looks like Markdown.
- **An AI assistant** writes Markdown through the [MCP connector](mcp/reference.md).

A Markdown **export** writes media in the same syntax. So a file you export imports back with its media, captions and sizes.

## Write a picture

Use standard Markdown image syntax:

```markdown
![A red bicycle](https://example.com/bicycle.png)
```

The text in the brackets is the alt text. A screen reader reads it.

## Write a player

Write the player name in the brackets, in place of the alt text:

```markdown
![youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
```

| Name         | The URL must be                                     |
| ------------ | --------------------------------------------------- |
| `video`      | a video file, such as `.mp4` or `.webm`             |
| `audio`      | an audio file, such as `.mp3` or `.ogg`             |
| `youtube`    | a YouTube video                                     |
| `vimeo`      | a Vimeo video                                       |
| `loom`       | a Loom recording                                    |
| `soundcloud` | a SoundCloud track or playlist                      |
| `spotify`    | a Spotify track, album, playlist, artist or episode |
| `x`          | a post on X or Twitter                              |

When the URL does not match the name, docs.plus imports a picture instead.

For `video` and `audio`, the URL must end in the file extension. Before the extension, the path may hold only letters, digits, `_`, `-` and `/`. So `clip.mp4?token=1` and `/v1.2/clip.mp4` import as a picture.

## Add a caption

Put the caption in quotes after the URL. It works on a picture and on every player:

```text
![youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ "How docs.plus works")
```

To use a `"` inside the caption, write `\"`.

## Set the size and the position

Put an option block in braces right after the closing parenthesis, with no space between them:

```text
![youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ "How docs.plus works"){width=800 float=right}
```

Separate the options with spaces. Put quotes around a value that holds a space, such as `margin="0 0 0 auto"`. Single quotes work too.

| Option            | What it does                         | Values                                                                                      |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `width`           | width in pixels                      | a number, such as `800`                                                                     |
| `height`          | height in pixels                     | a number, such as `450`                                                                     |
| `float`           | lets text wrap beside the media      | `left`, `right`, `none`                                                                     |
| `margin`          | space around the media               | one to four of `auto`, `0`, or a length in `px`, `in`, `em`, `rem`, `%`, `pt`, `cm` or `mm` |
| `clear`           | starts the media below floated media | `none`, `left`, `right`, `both`                                                             |
| `display`         | the CSS display of the media         | `block`, `inline`, `inline-block`, `flex`, `inline-flex`                                    |
| `justify-content` | the CSS alignment inside the frame   | `start`, `center`, `end`, `flex-start`, `flex-end`, `left`, `right`                         |

An X post takes `maxwidth` in place of `width` and `height`. A picture takes no `justify-content`.

## Set player options

A `video` or an `audio` player also takes these options in the same block:

| Option     | What it does                        | Values                     |
| ---------- | ----------------------------------- | -------------------------- |
| `controls` | shows the play controls             | `true`, `false`            |
| `autoplay` | starts playing on load              | `true`, `false`            |
| `loop`     | plays again from the start          | `true`, `false`            |
| `muted`    | starts with the sound off           | `true`, `false`            |
| `preload`  | how much to load before play        | `none`, `metadata`, `auto` |
| `poster`   | the picture before play, video only | a URL                      |

A muted video with a caption and a width:

```text
![video](https://example.com/clip.mp4 "Launch demo"){width=800 muted=true}
```

An `x` post takes `theme` (`light` or `dark`), `lang` (such as `fr`), `hide_media` and `hide_thread` (`true` or `false`).

## What docs.plus leaves out

- **An option it does not know.** docs.plus drops it with no warning. It also drops a value that fails its check, such as `width=wide`, and an option the media kind does not take. Each drop removes that one option, and the media keeps its default for it. The rest of the block still applies.
- **A block with no closing brace.** It is not an option block. The media still imports, and the text after it stays as text.
- **An option at its default.** An export writes only the options you changed. A player nobody resized exports as `![youtube](URL)`.
- **The YouTube, Vimeo, Loom, SoundCloud and Spotify player settings.** An export does not write them, such as a YouTube start time.

A Markdown import holds at most 65 536 characters. Each option makes a line longer.

## Older Markdown

Import still reads the older size form, inside the parentheses: `![video](URL width=400 height=300)`.

Text in braces right after a picture or a player is read as an option block. So `![chart](chart.png){draft}` loses `{draft}`. To keep such text, put a space before the brace.

## Outside docs.plus

Other Markdown apps do not know the option block. GitHub, for example, shows the picture and prints the block as plain text after it. The caption still shows as a tooltip.

A DOCX or ODT export cannot hold a player. There, a player becomes a link to its URL, with the caption as the link text.
