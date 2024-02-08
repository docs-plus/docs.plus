import React, { useRef, useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Facebook, Twitter, Linkedin, At, World } from '@icons'
import Button from '@components/ui/Button'
import { useStore } from '@stores'
const socialSharingMap = {
  facebook: `https://www.facebook.com/sharer.php?u=`,
  twitter: `https://twitter.com/intent/tweet?url=`,
  linkedin: `https://www.linkedin.com/shareArticle?url=`,
  email: `mailto:?body=`
}

const ShareModal = () => {
  const urlRef = useRef() as any
  const [href, setHref] = useState('')
  const { metadata: docMetadata } = useStore((state) => state.settings)

  useEffect(() => {
    setHref(window.location.href)
  }, [])

  const handleShare = (social: string) => {
    const url = socialSharingMap[social as keyof typeof socialSharingMap]

    if (url) {
      window.open(`${url}${href}`, '_blank')
    } else {
      console.info('Unknown social')
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(href)
    toast.success('Link copied to clipboard!')
  }

  const webShareAPI = () => {
    if (navigator.share) {
      navigator
        .share({
          title: docMetadata.title,
          text: docMetadata.description,
          url: href
        })
        .then(() => console.info('Successful share'))
        .catch((error) => console.error('Error sharing', error))
    } else {
      console.info("Your Browser doesn't support Web Share API")
    }
  }

  return (
    <div className="flex flex-col antialiased p-4 w-[32rem] rounded-md border shadow-md z-50 bg-white">
      <div className="flex space-x-4">
        <Button Icon={Facebook} onClick={() => handleShare('facebook')}>
          Facebook
        </Button>
        <Button Icon={Twitter} onClick={() => handleShare('twitter')}>
          Twitter
        </Button>
      </div>

      <div className="flex mt-3 space-x-4">
        <Button Icon={Linkedin} onClick={() => handleShare('linkedin')}>
          LinkedIn
        </Button>
        <Button Icon={At} onClick={() => handleShare('email')}>
          Email
        </Button>
      </div>
      <div className="flex mt-5 justify-between bg-neutral-200 p-2 rounded-md">
        <input
          className="bg-transparent w-9/12 outline-none pl-1"
          ref={urlRef}
          value={href}
          readOnly
        />
        <Button className="w-3/12 border-neutral-400" onClick={copyToClipboard}>
          Copy Link
        </Button>
      </div>
      {/* {typeof navigator !== 'undefined' && navigator.share && (
        <div className="mt-5 ">
          <Button Icon={World} className="" onClick={webShareAPI}>
            Web Share
          </Button>
        </div>
      )} */}
    </div>
  )
}

export default ShareModal
