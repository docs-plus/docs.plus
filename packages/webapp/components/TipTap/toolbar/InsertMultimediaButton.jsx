import { Popover, PopoverTrigger, PopoverContent } from '@components/ui/Popover'
import React, { useState, useCallback, useEffect } from 'react'
import { ImageBox, Youtube, Vimeo, SoundCloud, Picture, XTwitter } from '@icons'
import Button from '@components/ui/Button'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import ToolbarButton from './ToolbarButton'
import { use } from 'react'

const MediaTypes = ['Picture', 'Youtube', 'Vimeo', 'SoundCloud', 'XTwitter']

const MediaRegex = {
  Youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/g,
  Vimeo: /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com)\/?(.+)/g,
  SoundCloud: /(?:https?:\/\/)?(?:www\.)?(?:soundcloud\.com)\/?(.+)/g,
  XTwitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com)\/?(.+)/g,
  Picture: /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i,
}

const icons = {
  Picture,
  Youtube,
  Vimeo,
  SoundCloud,
  XTwitter
}

const MediaSet = {
  Youtube: "setYoutubeVideo",
  Vimeo: "setVimeo",
  SoundCloud: "setSoundCloud",
  XTwitter: "setTwitter",
  Picture: "setImage",
}


function HyperlinkForm({ onSubmit }) {
    const [mediaURL, setMediaURL] = useState('')
    const [mediaType, setMediaType] = useState(MediaTypes[0])
    const inputRef = React.useRef(null)

    useEffect(() => {
      //For UX side
      setTimeout(() => {
        inputRef.current.focus()
      }, 300);
    }, [mediaType])

    const inputURLChange = (e) => {
      if(!e.target.value) return setMediaURL('')
      // loop through the MediaRegex and check the url belong to which type of media
      // if it is not belong to any type, set it to Picture
      for (const [key, value] of Object.entries(MediaRegex)) {
        if (value.test(e.target.value)) {
          setMediaType(key)
          break
        }
      }
      setMediaURL(e.target.value)
    }

    return (
      <form
        className="bg-white border border-gray-100 flex flex-col p-2 w-96 rounded-md shadow-md z-50"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(mediaURL, mediaType)
        }}>
          <div>
            <div className='flex justify-center items-center mb-2 border-b pb-2'>
              {MediaTypes.map((type) => (
                  <Button
                    key={type}
                    Icon= {icons[type]}
                    iconSize={18}
                    iconFill={`${mediaType === type ? 'rgba(0,0,0,.9)' : 'rgba(0,0,0,.4)'}`}
                    className={`${mediaType === type ? 'bg-gray-200' : ''} mr-1 cursor-pointer border-none hover:bg-gray-100 items-center justify-center flex`}
                    onClick={() => setMediaType(type)} />

              ))}
            </div>
            <div className="w-full flex justify-between items-center">
              <InputOverlapLabel
                className="w-8/12"
                label={`${mediaType} URL...`}
                value={mediaURL}
                ref={inputRef}
                onChange={inputURLChange}
              />
              <Button className="w-4/12 ml-2" onClick={()=>onSubmit(mediaURL, mediaType)}>Insert</Button>
            </div>
          </div>
      </form>
    )
  }

const InsertMultimedia = ({ editor }) => {
  const insertMedia = useCallback((mediaUrl, mediaType) => {
    if(!mediaUrl) return
      editor.chain().focus()[MediaSet[mediaType]]({ src: mediaUrl }).run()
  }, [editor])

  return (
    <Popover>
      <PopoverTrigger asChild={true}>
        <ToolbarButton tooltip="Insert Image">
          <ImageBox fill="rgba(0,0,0,.7)" size="14" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="z-50">
        <HyperlinkForm variant="youtube" onSubmit={insertMedia} />
      </PopoverContent>
    </Popover>
  )
}

export default InsertMultimedia
