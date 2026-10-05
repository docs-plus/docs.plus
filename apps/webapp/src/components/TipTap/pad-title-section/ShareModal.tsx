import { documentSettingsOpenRequest } from '@components/TipTap/toolbar/desktop/popoverOpenRequest'
import Button from '@components/ui/Button'
import { ModalBody, ModalClose, ModalDescription, ModalHeading } from '@components/ui/Dialog'
import { Tooltip } from '@components/ui/Tooltip'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { usePadShareUrl } from '@hooks/usePadShareUrl'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import type { IconType } from 'react-icons'
import { BsReddit } from 'react-icons/bs'
import { FaFacebook } from 'react-icons/fa'
import { FaLinkedin, FaSquareXTwitter, FaWhatsapp } from 'react-icons/fa6'

import PresentQrCode from './PresentQrCode'

interface ShareTarget {
  label: string
  icon: IconType
  color: string
  /** Both arguments arrive already URI-encoded. */
  href: (url: string, title: string) => string
  newTab: boolean
}

const shareTargets: ShareTarget[] = [
  {
    label: 'Facebook',
    icon: FaFacebook,
    color: 'text-[#1877f2]',
    href: (url) => `https://www.facebook.com/sharer.php?u=${url}`,
    newTab: true
  },
  {
    label: 'X',
    icon: FaSquareXTwitter,
    color: 'text-base-content',
    href: (url) => `https://twitter.com/intent/tweet?url=${url}`,
    newTab: true
  },
  {
    label: 'LinkedIn',
    icon: FaLinkedin,
    color: 'text-[#0a66c2]',
    href: (url) => `https://www.linkedin.com/shareArticle?url=${url}`,
    newTab: true
  },
  {
    label: 'WhatsApp',
    icon: FaWhatsapp,
    color: 'text-[#25d366]',
    href: (url) => `https://wa.me/?text=${url}`,
    newTab: true
  },
  {
    label: 'Reddit',
    icon: BsReddit,
    color: 'text-[#ff4500]',
    href: (url) => `https://reddit.com/submit?url=${url}`,
    newTab: true
  },
  {
    label: 'Email',
    icon: Icons.mail,
    color: 'text-base-content/60',
    href: (url, title) => `mailto:?subject=${title}&body=${url}`,
    newTab: false
  }
]

// Mirrors the server: only `readOnly` stops a visitor from editing a public document.
const accessLines = {
  private: { icon: Icons.lock, text: 'Private. Only you can open it.' },
  view: { icon: Icons.eye, text: 'Anyone with the link can view' },
  edit: { icon: Icons.pencil, text: 'Anyone with the link can edit' }
}

interface ShareModalProps {
  setIsOpen: (open: boolean) => void
}

const ShareModal = ({ setIsOpen }: ShareModalProps) => {
  const docMetadata = useStore((state) => state.settings.metadata)
  const profileId = useAuthStore((state) => state.profile?.id)
  const { copy, copied } = useCopyToClipboard({ successMessage: 'Link copied!' })

  const isPrivate = Boolean(docMetadata?.isPrivate)
  const access = accessLines[isPrivate ? 'private' : docMetadata?.readOnly ? 'view' : 'edit']
  const isOwner = Boolean(profileId && profileId === docMetadata?.ownerId)
  const canChangeAccess = isOwner && documentSettingsOpenRequest.canRequest()
  const title = docMetadata?.title || 'Untitled document'

  const shareUrl = usePadShareUrl()
  const hasWebShare = typeof navigator.share === 'function'

  const openDocumentSettings = () => {
    setIsOpen(false)
    documentSettingsOpenRequest.request()
  }

  const webShare = () => {
    navigator.share({ title, text: docMetadata?.description, url: shareUrl }).catch(() => {})
  }

  return (
    <ModalBody className="min-h-0 overflow-y-auto">
      <ModalHeading className="pr-10">Share this document</ModalHeading>
      <ModalClose />

      {isPrivate ? (
        <p className="text-base-content/70 text-sm">
          Turn off Private in Settings to share a link or a QR code.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[12.25rem_minmax(0,1fr)] sm:items-center sm:gap-x-4">
          <PresentQrCode value={shareUrl} title={title} />

          <div className="grid min-w-0 content-start gap-4 max-sm:order-first">
            <div className="border-base-300 bg-base-100 rounded-field focus-within:border-primary flex items-center gap-2 border p-1.5">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Document link"
                className="text-base-content w-0 min-w-0 flex-1 bg-transparent px-2 text-sm focus:outline-none"
                onClick={(e) => e.currentTarget.select()}
              />
              {hasWebShare && (
                <Tooltip title="More sharing options">
                  <button
                    type="button"
                    onClick={webShare}
                    aria-label="More sharing options"
                    className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-base-content">
                    <Icons.shareNative size={16} />
                  </button>
                </Tooltip>
              )}
              <button
                type="button"
                onClick={() => copy(shareUrl)}
                aria-label={copied ? 'Copied' : 'Copy link'}
                className={`btn btn-sm px-4 font-medium ${copied ? 'btn-success' : 'btn-primary'}`}>
                <span className={`swap ${copied ? 'swap-active' : ''}`} aria-hidden>
                  <span className="swap-on flex items-center gap-1.5">
                    <Icons.check size={16} />
                    Copied
                  </span>
                  <span className="swap-off flex items-center gap-1.5">
                    <Icons.copy size={16} />
                    Copy link
                  </span>
                </span>
              </button>
            </div>
            <span role="status" className="sr-only">
              {copied ? 'Link copied' : ''}
            </span>

            <div className="grid gap-2">
              <span id="share-via-label" className="text-base-content/70 text-meta font-semibold">
                Share via
              </span>
              <div
                role="group"
                aria-labelledby="share-via-label"
                className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {shareTargets.map(({ label, icon: Icon, color, href, newTab }) => (
                  <a
                    key={label}
                    href={href(encodeURIComponent(shareUrl), encodeURIComponent(title))}
                    {...(newTab && { target: '_blank', rel: 'noopener noreferrer' })}
                    className="rounded-field text-base-content/70 hover:bg-base-200 hover:text-base-content focus-visible:ring-primary flex min-h-10 items-center gap-2 px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none">
                    <Icon size={20} className={`shrink-0 ${color}`} />
                    {label}
                    {newTab && <span className="sr-only">(opens in new tab)</span>}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-base-content/70 flex items-center gap-1.5 text-sm">
        <access.icon size={16} />
        <ModalDescription className="min-w-0">{access.text}</ModalDescription>
        {canChangeAccess && (
          <Button variant="quiet" onClick={openDocumentSettings} className="ml-1 shrink-0">
            Change
          </Button>
        )}
      </div>
    </ModalBody>
  )
}

export default ShareModal
