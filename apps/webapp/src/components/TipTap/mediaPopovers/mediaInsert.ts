import type { PanelTabOption } from '@components/ui/PanelTabBar'
import { type MediaNodeType, parseYoutubeVideoId } from '@docs.plus/extension-hypermultimedia'
import { FaSoundcloud, FaVimeo, FaXTwitter, FaYoutube } from 'react-icons/fa6'
import { FiFilm, FiVideo } from 'react-icons/fi'
import { MdAudiotrack, MdOutlineImage } from 'react-icons/md'

import type { MediaInsertEntry, MediaTab } from './types'

/** The two insert modes, rendered by the shared PanelTabBar. */
export const MEDIA_INSERT_TABS: readonly PanelTabOption<MediaTab>[] = [
  { label: 'Embed URL' },
  { label: 'Upload' }
]

/** Single source mapping each detected node type to its label, icon, and kit command. */
export const MEDIA_INSERT_REGISTRY: Record<MediaNodeType, MediaInsertEntry> = {
  image: {
    label: 'Picture',
    Icon: MdOutlineImage,
    insert: (editor, payload) => editor.chain().focus().setImage(payload).run(),
    preview: (url) => ({ kind: 'img', src: url })
  },
  video: {
    label: 'Video',
    Icon: FiVideo,
    insert: (editor, payload) => editor.chain().focus().setVideo(payload).run(),
    // Direct file URL — the browser renders it natively; no backend/oEmbed.
    preview: (url) => ({ kind: 'video', src: url })
  },
  audio: {
    label: 'Audio',
    Icon: MdAudiotrack,
    insert: (editor, payload) => editor.chain().focus().setAudio(payload).run(),
    preview: (url) => ({ kind: 'audio', src: url })
  },
  youtube: {
    label: 'YouTube',
    Icon: FaYoutube,
    insert: (editor, payload) => editor.chain().focus().setYoutubeVideo(payload).run(),
    // Static thumbnail by video id — no oEmbed/API call; img-src already allows https.
    preview: (url) => {
      const id = parseYoutubeVideoId(url)
      return id
        ? { kind: 'img', src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, badge: true }
        : null
    }
  },
  vimeo: {
    label: 'Vimeo',
    Icon: FaVimeo,
    insert: (editor, payload) => editor.chain().focus().setVimeo(payload).run(),
    unfurl: true
  },
  soundcloud: {
    label: 'SoundCloud',
    Icon: FaSoundcloud,
    insert: (editor, payload) => editor.chain().focus().setSoundCloud(payload).run(),
    unfurl: true
  },
  loom: {
    label: 'Loom',
    Icon: FiFilm,
    insert: (editor, payload) => editor.chain().focus().setLoom(payload).run(),
    unfurl: true
  },
  x: {
    label: 'X',
    Icon: FaXTwitter,
    insert: (editor, payload) => editor.chain().focus().setX(payload).run()
  }
}
