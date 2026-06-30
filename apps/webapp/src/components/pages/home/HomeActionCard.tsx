import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { FormEvent, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { HOME_REGION_DURATION, HOME_SLUG_INPUT_ID, homeRegionEase } from './homeMobileLayout'
import { prefetchDocumentShell } from './hooks/useNavigateToDocument'

interface HomeActionCardProps {
  hostname: string
  isLoading: boolean
  onNavigate: (name?: string) => void | Promise<void>
  compact?: boolean
}

export function HomeActionCard({
  hostname,
  isLoading,
  onNavigate,
  compact = false
}: HomeActionCardProps) {
  const [documentName, setDocumentName] = useState('')
  const [pending, setPending] = useState<'create' | 'open' | null>(null)
  const trimmed = documentName.trim()

  useEffect(() => {
    if (!isLoading) setPending(null)
  }, [isLoading])

  const createDoc = () => {
    if (isLoading) return
    setPending('create')
    onNavigate()
  }

  const openDoc = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isLoading || !trimmed) return
    setPending('open')
    onNavigate(documentName)
  }

  return (
    <div
      className={twMerge(
        'rounded-box bg-base-100 p-5 shadow-xl motion-safe:animate-[doc-region-in_220ms_ease-out_60ms_both] motion-safe:transition-[padding,box-shadow]',
        HOME_REGION_DURATION,
        homeRegionEase(compact),
        'sm:p-8',
        compact && 'max-sm:p-4 max-sm:shadow-lg'
      )}>
      <Button
        variant="primary"
        shape="block"
        size="lg"
        className="mb-6 text-base font-bold sm:mb-8"
        onClick={createDoc}
        onMouseEnter={prefetchDocumentShell}
        onFocus={prefetchDocumentShell}
        disabled={isLoading}
        loading={pending === 'create'}
        aria-busy={pending === 'create'}>
        Create New Document
      </Button>

      <div className="mb-6 flex items-center gap-3 sm:mb-8 sm:gap-4">
        <div className="bg-base-300 h-px flex-1" />
        <span className="text-base-content/50 text-xs sm:text-sm">or open existing</span>
        <div className="bg-base-300 h-px flex-1" />
      </div>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={openDoc}>
        <TextInput
          id={HOME_SLUG_INPUT_ID}
          wrapperClassName="flex-1"
          size="lg"
          label={`${hostname}/`}
          labelClassName="max-w-[45%] shrink-0 truncate"
          aria-label="Document name to open"
          type="text"
          minLength={3}
          maxLength={30}
          value={documentName}
          inputMode="text"
          enterKeyHint="go"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={isLoading}
          placeholder="document-name"
          onChange={(e) => setDocumentName(e.target.value)}
          onFocus={prefetchDocumentShell}
          containerClassName="w-full"
        />
        <Button
          type="submit"
          variant="neutral"
          size="lg"
          className="w-full px-8 sm:h-auto sm:w-auto"
          disabled={isLoading || !trimmed}
          loading={pending === 'open'}
          aria-busy={pending === 'open'}>
          Open
        </Button>
      </form>
    </div>
  )
}
