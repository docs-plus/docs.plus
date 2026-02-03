import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { useStore } from '@stores'
import { useEffect, useState } from 'react'
import { BsReddit } from 'react-icons/bs'
import { FaFacebook } from 'react-icons/fa'
import { FaLinkedin, FaSquareXTwitter, FaWhatsapp } from 'react-icons/fa6'
import {
  MdCheck,
  MdClose,
  MdContentCopy,
  MdIosShare,
  MdOutlineAlternateEmail
} from 'react-icons/md'

const socialSharingMap = {
  facebook: 'https://www.facebook.com/sharer.php?u=',
  twitter: 'https://twitter.com/intent/tweet?url=',
  linkedin: 'https://www.linkedin.com/shareArticle?url=',
  whatsapp: 'https://wa.me/?text=',
  reddit: 'https://reddit.com/submit?url=',
  email: 'mailto:?body='
}

const socialButtons = [
  {
    key: 'facebook',
    icon: FaFacebook,
    label: 'Facebook',
    color: 'text-[#1877f2]',
    hoverBg: 'hover:bg-[#1877f2]'
  },
  {
    key: 'twitter',
    icon: FaSquareXTwitter,
    label: 'X',
    color: 'text-black',
    hoverBg: 'hover:bg-black'
  },
  {
    key: 'linkedin',
    icon: FaLinkedin,
    label: 'LinkedIn',
    color: 'text-[#0a66c2]',
    hoverBg: 'hover:bg-[#0a66c2]'
  },
  {
    key: 'whatsapp',
    icon: FaWhatsapp,
    label: 'WhatsApp',
    color: 'text-[#25d366]',
    hoverBg: 'hover:bg-[#25d366]'
  },
  {
    key: 'reddit',
    icon: BsReddit,
    label: 'Reddit',
    color: 'text-[#ff4500]',
    hoverBg: 'hover:bg-[#ff4500]'
  },
  {
    key: 'email',
    icon: MdOutlineAlternateEmail,
    label: 'Email',
    color: 'text-slate-500',
    hoverBg: 'hover:bg-slate-500'
  }
]

interface ShareModalProps {
  setIsOpen: (open: boolean) => void
}

const ShareModal = ({ setIsOpen }: ShareModalProps) => {
  const [href, setHref] = useState('')
  const { metadata: docMetadata } = useStore((state) => state.settings)
  const { copy, copied } = useCopyToClipboard({ successMessage: 'Link copied!' })

  useEffect(() => {
    setHref(window.location.href)
  }, [])

  const handleShare = (social: string) => {
    const url = socialSharingMap[social as keyof typeof socialSharingMap]
    if (social === 'whatsapp') {
      window.open(`${url}${encodeURIComponent(href)}`, '_blank')
    } else if (url) {
      window.open(`${url}${href}`, '_blank')
    }
  }

  const webShareAPI = () => {
    if (navigator.share) {
      navigator
        .share({
          title: docMetadata.title,
          text: docMetadata.description,
          url: href
        })
        .catch(() => {})
    }
  }

  const hasWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-base-content text-lg font-semibold">Share this document</h2>
          <p className="text-base-content/50 mt-0.5 text-sm">Anyone with the link can view</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:text-base-content -mt-1 -mr-2">
          <MdClose size={20} />
        </button>
      </div>

      {/* Copy Link */}
      <div className="border-base-300 bg-base-100 flex items-center gap-2 rounded-lg border p-2">
        <input
          type="text"
          readOnly
          value={href}
          className="text-base-content/70 min-w-0 flex-1 bg-transparent px-2 text-sm focus:outline-none"
          onClick={(e) => e.currentTarget.select()}
        />
        <div className="flex shrink-0 gap-1">
          {hasWebShare && (
            <button
              onClick={webShareAPI}
              title="More sharing options"
              className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content">
              <MdIosShare size={18} />
            </button>
          )}
          <button
            onClick={() => copy(href)}
            className={`btn btn-sm gap-1.5 px-4 font-medium ${copied ? 'btn-success' : 'btn-primary'}`}>
            {copied ? (
              <>
                <MdCheck size={16} />
                Copied
              </>
            ) : (
              <>
                <MdContentCopy size={14} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="bg-base-300 h-px flex-1" />
        <span className="text-base-content/40 text-xs tracking-wide uppercase">share via</span>
        <div className="bg-base-300 h-px flex-1" />
      </div>

      {/* Social Icons with Brand Colors */}
      <div className="flex items-center justify-between gap-2">
        {socialButtons.map(({ key, icon: Icon, label, color, hoverBg }) => (
          <button
            key={key}
            onClick={() => handleShare(key)}
            title={label}
            className={`flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl p-3 transition-all ${color} ${hoverBg} hover:text-white`}>
            <Icon size={24} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ShareModal
