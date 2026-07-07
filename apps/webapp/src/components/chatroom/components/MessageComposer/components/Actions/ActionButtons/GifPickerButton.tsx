import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  fetchTrendingGifs,
  type GiphyGif,
  giphyGifToFile,
  searchGiphy
} from '@components/chatroom/utils/giphySearch'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useComposerAttachmentActions } from '../../../hooks'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const GifPickerButton = ({ className, size: _size = 18, ...props }: Props) => {
  const { channelId } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const { addFiles } = useComposerAttachmentActions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasApiKey = Boolean(process.env.NEXT_PUBLIC_GIPHY_API_KEY?.trim())

  // Light-dismiss: outside pointer + Escape. Escape is captured so it closes the
  // picker before the composer's window-level handler clears reply/edit.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const loadGifs = useCallback(
    async (searchQuery: string) => {
      if (!hasApiKey) {
        setError('GIF search is not configured')
        setGifs([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const results = searchQuery.trim()
          ? await searchGiphy(searchQuery)
          : await fetchTrendingGifs()
        setGifs(results)
        if (results.length === 0) setError('No GIFs found')
      } catch {
        setError('Could not load GIFs')
        setGifs([])
      } finally {
        setLoading(false)
      }
    },
    [hasApiKey]
  )

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void loadGifs(query)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [loadGifs, open, query])

  const onToggle = useCallback(() => {
    if (!user?.id) {
      openComposerSignIn(channelId)
      return
    }
    setOpen((prev) => !prev)
  }, [channelId, user?.id])

  const onSelect = useCallback(
    (gif: GiphyGif) => {
      void giphyGifToFile(gif)
        .then((file) => {
          addFiles([file])
          setOpen(false)
        })
        .catch(() => setError('Could not add GIF'))
    },
    [addFiles]
  )

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        className={twMerge(
          'rounded-field size-9 min-h-0 min-w-9 shrink-0 border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
          open && 'text-primary bg-primary/10',
          className
        )}
        onPress={onToggle}
        tooltip="Add GIF"
        tooltipPosition="top"
        aria-label="Add GIF"
        aria-expanded={open}
        data-testid="composer-gif-button"
        {...props}>
        <span className="text-xs font-bold tracking-tight">GIF</span>
      </Button>

      {open ? (
        <div className="bg-base-100 border-base-300 rounded-box absolute bottom-full left-0 z-50 mb-2 w-[min(20rem,calc(100vw-2rem))] border p-2 shadow-xl">
          <div className="mb-2 flex items-center gap-1">
            <Icons.search size={14} className="text-base-content/50 shrink-0" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search GIFs"
              className="input input-sm input-bordered w-full min-w-0"
              aria-label="Search GIFs"
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square shrink-0"
              aria-label="Close GIF picker"
              onClick={() => setOpen(false)}>
              <Icons.close size={14} />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-sm text-primary" />
            </div>
          ) : error ? (
            <p className="text-base-content/60 px-1 py-4 text-center text-xs">{error}</p>
          ) : (
            <div className="grid max-h-56 grid-cols-3 gap-1 overflow-y-auto">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  className="bg-base-200 hover:ring-primary rounded-field overflow-hidden ring-offset-2 hover:ring-2"
                  aria-label={`Insert GIF ${gif.title}`}
                  onClick={() => onSelect(gif)}>
                  <img
                    src={gif.previewUrl}
                    alt=""
                    className="aspect-square size-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
