import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useStore } from '@stores'
import { BsReddit } from 'react-icons/bs'
import { IoCloseSharp } from 'react-icons/io5'
import * as toast from '@components/toast'
import { FaFacebook } from 'react-icons/fa'
import { FaSquareXTwitter } from 'react-icons/fa6'
import { FaLinkedin } from 'react-icons/fa6'
import { FaWhatsapp } from 'react-icons/fa6'
import { MdOutlineAlternateEmail } from 'react-icons/md'
import { FaEarthAfrica } from 'react-icons/fa6'
import { MdContentCopy } from 'react-icons/md'

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
        <button className="btn btn-square btn-xs ml-auto" onClick={() => setIsOpen(false)}>
          <IoCloseSharp size={20} />
        </button>
      </div>
      <div className="flex justify-around space-x-4">
        <button
          className="btn btn-square btn-dash btn-outline text-docsy flex-1 hover:border-[#1877f2] hover:bg-[#1877f2] hover:text-white"
          onClick={() => handleShare('facebook')}>
          <FaFacebook size={24} />
        </button>
        <button
          className="btn btn-square btn-dash btn-outline text-docsy flex-1 hover:border-[#000000] hover:bg-[#000000] hover:text-white"
          onClick={() => handleShare('twitter')}>
          <FaSquareXTwitter size={24} />
        </button>
        <button
          className="btn btn-square btn-dash btn-outline text-docsy flex-1 hover:border-[#0a66c2] hover:bg-[#0a66c2] hover:text-white"
          onClick={() => handleShare('linkedin')}>
          <FaLinkedin size={24} />
        </button>
        <button
          className="btn btn-square btn-dash btn-outline text-docsy flex-1 hover:border-[#25d366] hover:bg-[#25d366] hover:text-white"
          onClick={() => handleShare('whatsapp')}>
          <FaWhatsapp fontSize={24} />
        </button>
        <button
          className="btn btn-square btn-dash btn-outline text-docsy flex-1 hover:border-[#ff4500] hover:bg-[#ff4500] hover:text-white"
          onClick={() => handleShare('reddit')}>
          <BsReddit fontSize={24} />
        </button>
        <button
          className="btn btn-square btn-dash btn-outline text-docsy flex-1 hover:border-[#2778ff] hover:bg-[#2778ff] hover:text-white"
          onClick={() => handleShare('email')}>
          <MdOutlineAlternateEmail size={24} />
        </button>
      </div>

      <p className="mt-6 mb-2 font-semibold">Page Link</p>
      <div className="flex justify-between rounded-md" onClick={copyToClipboard}>
        <label className="input input-bordered flex w-full items-center gap-2">
          <input type="text" className="grow" ref={urlRef} value={href} readOnly />
          <button className="">
            <MdContentCopy size={18} />
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
              <FaEarthAfrica className="text-docsy mr-auto" size={20} />
              Web Share
            </button>
          </div>
        )
      }
    </div>
  )
}

export default ShareModal
