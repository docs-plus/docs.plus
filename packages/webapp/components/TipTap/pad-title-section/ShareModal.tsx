import React, { useRef, useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Facebook, Twitter, Linkedin, At, World } from '@icons'
import { useStore } from '@stores'
import { BsWhatsapp } from 'react-icons/bs'
import { BsReddit } from 'react-icons/bs'
import { FiCopy } from 'react-icons/fi'

const socialSharingMap = {
  facebook: `https://www.facebook.com/sharer.php?u=`,
  twitter: `https://twitter.com/intent/tweet?url=`,
  linkedin: `https://www.linkedin.com/shareArticle?url=`,
  whatsapp: `https://wa.me/?text=`,
  reddit: `https://reddit.com/submit?url=`,
  email: `mailto:?body=`
}

const ShareModal = ({ setIsOpen }: any) => {
  const urlRef = useRef() as any
  const [href, setHref] = useState('')
  const { metadata: docMetadata } = useStore((state) => state.settings)

  useEffect(() => {
    setHref(window.location.href)
  }, [])

  const handleShare = (social: string) => {
    const url = socialSharingMap[social as keyof typeof socialSharingMap]

    if (social === 'whatsapp') {
      window.open(`${url}${encodeURIComponent(href)}`, '_blank')
    } else if (url) {
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
    <div className=" p-4 pt-2 flex flex-col">
      <div className="flex mb-6">
        <p className="text-2xl font-semibold ">Share</p>
        <button className="btn btn-circle btn-sm ml-auto" onClick={() => setIsOpen(false)}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex space-x-4 justify-around">
        <button className="btn flex-1" onClick={() => handleShare('facebook')}>
          <Facebook />
        </button>
        <button className="btn flex-1" onClick={() => handleShare('twitter')}>
          <Twitter />
        </button>
        <button className="btn flex-1" onClick={() => handleShare('linkedin')}>
          <Linkedin />
        </button>
        <button className="btn flex-1" onClick={() => handleShare('whatsapp')}>
          <BsWhatsapp fontSize={24} color="rgb(104, 81, 255)" />
        </button>
        <button className="btn flex-1" onClick={() => handleShare('reddit')}>
          <BsReddit fontSize={24} color="rgb(104, 81, 255)" />
        </button>
        <button className="btn flex-1" onClick={() => handleShare('email')}>
          <At />
        </button>
      </div>

      <p className="font-semibold mt-6 mb-2">Page Link</p>
      <div className="flex  justify-between rounded-md">
        <label
          className="input input-bordered w-full flex items-center gap-2"
          onClick={copyToClipboard}>
          <input type="text" className="grow" ref={urlRef} value={href} readOnly />
          <button className="" onClick={copyToClipboard}>
            <FiCopy />
          </button>
        </label>
      </div>

      {
        // @ts-ignore
        typeof navigator !== 'undefined' && navigator.share && (
          <div className="mt-5 ">
            <button
              className="btn btn-block flex items-center justify-center"
              onClick={webShareAPI}>
              <World className="mr-auto" />
              Web Share
            </button>
          </div>
        )
      }
    </div>
  )
}

export default ShareModal
