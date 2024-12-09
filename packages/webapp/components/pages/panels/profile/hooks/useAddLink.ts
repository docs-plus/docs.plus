import { useState } from 'react'
import { ILinkItem } from '../types'
import { useLinkValidation } from './useLinkValidation'

export const useAddLink = () => {
  const [loading, setLoading] = useState(false)
  const { validateLink } = useLinkValidation()

  const addLink = async (newLink: string): Promise<{ error?: string; link?: ILinkItem | null }> => {
    setLoading(true)
    const { valid, type, error: validationError } = validateLink(newLink)

    if (!valid) {
      setLoading(false)
      return { error: validationError || 'Invalid link' }
    }

    try {
      const response = await fetch(`/api/fetchMetadata?url=${encodeURIComponent(newLink.trim())}`)
      const metadata = await response.json()

      if (metadata.error) {
        setLoading(false)
        return { error: 'Failed to fetch metadata' }
      }

      const link: ILinkItem = {
        url: newLink.trim(),
        type: type!,
        metadata
      }

      return { link }
    } catch (err) {
      return { error: 'An error occurred while fetching metadata' }
    } finally {
      setLoading(false)
    }
  }

  return { addLink, loading }
}
