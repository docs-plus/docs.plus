import { Popover, PopoverTrigger, PopoverContent } from '@components/ui/Popover'
import React, { useState, useCallback, useEffect } from 'react'
import { ImageBox, Youtube, Vimeo, SoundCloud, Picture, XTwitter, Film, MusicFile } from '@icons'
import Button from '@components/ui/Button'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import ToolbarButton from './ToolbarButton'
import toast from 'react-hot-toast'
import { useDocumentMetadataContext } from '@context/DocumentMetadataContext'

const MediaTypes = ['Picture', 'Film', 'MusicFile', 'Youtube', 'Vimeo', 'SoundCloud', 'XTwitter']

const MediaRegex = {
  Youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/g,
  Vimeo: /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com)\/?(.+)/g,
  SoundCloud: /(?:https?:\/\/)?(?:www\.)?(?:soundcloud\.com)\/?(.+)/g,
  XTwitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com)\/?(.+)/g,
  MusicFile:
    /^(?:(?:https?|ftp):\/\/(?:www\.)?[^\/]+\/|\/|\.\.?\/)?[\w\-\/\\]+.(mp3|wav|aac|flac|ogg|m4a|aiff|ape|asf|m4p|m4b|mp2|mpc|wma|webm|opus|ra|rm|wavpack|wv)$/i,
  Film: /^(?:(?:https?|ftp):\/\/(?:www\.)?[^\/]+\/|\/|\.\.?\/)?[\w\-\/\\]+.(mp4|avi|mov|wmv|flv|mkv|3gp|3g2|asf|divx|m4v|mpg|m2v|m4p|mts|m2ts|ogv|rm|rmvb|ts|vob|webm|qt|f4v)$/i,
  Picture:
    /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i
}

const icons = {
  Picture,
  Youtube,
  Vimeo,
  SoundCloud,
  XTwitter,
  Film,
  MusicFile
}

const MediaSet = {
  Youtube: 'setYoutubeVideo',
  Vimeo: 'setVimeo',
  SoundCloud: 'setSoundCloud',
  XTwitter: 'setTwitter',
  Film: 'setVideo',
  MusicFile: 'setAudio',
  Picture: 'setImage'
}

async function handleFileUpload(event, docMetadata, editor) {
  const file = event.target.files[0]
  if (!file) return

  const loadingToast = toast.loading('Uploading file...')

  const formdata = new FormData()
  formdata.append('mediaFile', file, file.name)

  const requestOptions = {
    method: 'POST',
    body: formdata,
    redirect: 'follow'
  }

  try {
    const response = await fetch(
      `http://localhost:2300/api/plugins/hypermultimedia/${docMetadata.documentId}`,
      requestOptions
    )

    if (!response.ok) {
      toast.dismiss(loadingToast)
      toast.error('Error uploading file')
      return console.error('error', response)
    }

    const result = await response.json()
    const mediaURL = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${result.fileAddress}`

    if (!result.fileType) {
      toast.dismiss(loadingToast)
      toast.error('File type is not recognized.')
      return console.error('error', result)
    }

    const insertMediaContent = (type, url) => {
      editor.commands.insertContent({
        type,
        attrs: { src: url }
      })
    }

    const fileTypes = {
      image: 'Image',
      video: 'Video',
      audio: 'Audio'
    }

    const mediaType = fileTypes[result.fileType] || 'Image'
    insertMediaContent(mediaType, mediaURL)

    toast.dismiss(loadingToast)
    toast.success(<b>Upload successful!</b>)
  } catch (error) {
    toast.dismiss(loadingToast)
    toast.error('Error uploading file')
    console.error('error', error)
  }
}

function HyperlinkForm({ onSubmit, editor }) {
  const docMetadata = useDocumentMetadataContext()

  const [mediaURL, setMediaURL] = useState('')
  const [mediaType, setMediaType] = useState(MediaTypes[0])
  const inputRef = React.useRef(null)

  useEffect(() => {
    //For UX side
    setTimeout(() => {
      inputRef.current.focus()
    }, 300)
  }, [mediaType])

  const inputURLChange = (e) => {
    if (!e.target.value) return setMediaURL('')
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
        <div className="flex justify-center items-center mb-2 border-b pb-2">
          {MediaTypes.map((type) => (
            <Button
              key={type}
              Icon={icons[type]}
              iconSize={18}
              iconFill={`${mediaType === type ? 'rgba(0,0,0,.9)' : 'rgba(0,0,0,.4)'}`}
              className={`${
                mediaType === type ? 'bg-gray-200' : ''
              } mr-1 cursor-pointer border-none hover:bg-gray-100 items-center justify-center flex`}
              onClick={() => setMediaType(type)}
            />
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
          <Button className="w-4/12 ml-2" onClick={() => onSubmit(mediaURL, mediaType)}>
            Insert
          </Button>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-center w-full mt-2 border-t pt-2">
          <label
            htmlFor="dropzone-file"
            className="flex flex-col items-center justify-center w-full h-36 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 16">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Picture, Video or Audio (MAX. 2MB)
              </p>
            </div>
            <input
              id="dropzone-file"
              type="file"
              className="hidden"
              onChange={(e) => handleFileUpload(e, docMetadata, editor)}
            />
          </label>
        </div>
      </div>
    </form>
  )
}

const InsertMultimedia = ({ editor, docMetadata }) => {
  const insertMedia = useCallback(
    (mediaUrl, mediaType) => {
      if (!mediaUrl) return
      editor.chain().focus()[MediaSet[mediaType]]({ src: mediaUrl }).run()
    },
    [editor]
  )

  return (
    <Popover>
      <PopoverTrigger asChild={true}>
        <ToolbarButton tooltip="Insert Image">
          <ImageBox fill="rgba(0,0,0,.7)" size="14" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="z-50">
        <HyperlinkForm
          variant="youtube"
          editor={editor}
          onSubmit={insertMedia}
          docMetadata={docMetadata}
        />
      </PopoverContent>
    </Popover>
  )
}

export default InsertMultimedia
