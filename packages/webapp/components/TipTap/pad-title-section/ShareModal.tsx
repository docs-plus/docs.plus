import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Facebook, Twitter, Linkedin, At, World } from '@icons'
import { useStore } from '@stores'
import { BsWhatsapp } from 'react-icons/bs'
import { BsReddit } from 'react-icons/bs'
import { FiCopy } from 'react-icons/fi'
import { IoCloseSharp } from 'react-icons/io5'
import * as toast from '@components/toast'

const socialSharingMap = {
  facebook: `https://www.facebook.com/sharer.php?u=`,
  twitter: `https://twitter.com/intent/tweet?url=`,
  linkedin: `https://www.linkedin.com/shareArticle?url=`,
  whatsapp: `https://wa.me/?text=`,
  reddit: `https://reddit.com/submit?url=`,
  email: `mailto:?body=`
}

const ShareModal = ({ setIsOpen }: any) => {
  const urlRef = useRef<HTMLInputElement>(null)
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

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(href)
      toast.Success('Link copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy the link to clipboard', err)
      toast.Error('Failed to copy the link. Please try again.')
    }
  }, [href])

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
    <div className="flex flex-col p-3 pt-2">
      <div className="mb-6 flex">
        <p className="text-2xl font-semibold">Share</p>
        <button className="btn btn-circle btn-xs ml-auto" onClick={() => setIsOpen(false)}>
          <IoCloseSharp size={20} />
        </button>
      </div>
      <div className="flex justify-around space-x-4">
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

      <p className="mb-2 mt-6 font-semibold">Page Link</p>
      <div className="flex justify-between rounded-md" onClick={copyToClipboard}>
        <label className="input input-bordered flex w-full items-center gap-2">
          <input type="text" className="grow" ref={urlRef} value={href} readOnly />
          <button className="">
            <FiCopy />
          </button>
        </label>
      </div>

      {
        // @ts-ignore
        typeof navigator !== 'undefined' && navigator.share && (
          <div className="mt-5">
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
