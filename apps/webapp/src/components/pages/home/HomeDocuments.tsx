import { useOwnerDocuments } from '@components/settings/hooks/useOwnerDocuments'
import { documentListDate } from '@components/settings/utils/documentListDate'
import Button from '@components/ui/Button'
import { useRouter } from 'next/router'
import { LuFileText, LuStar } from 'react-icons/lu'

const HOME_DOCUMENTS_LIMIT = 8

interface HomeDocumentsProps {
  userId: string
  onSeeAll: () => void
}

/**
 * A short door into Settings → Documents, not a second library. Same Owner live list key
 * as Settings under Last opened. Favorites still pin first, so the heading names no order.
 * Hidden while loading, on error and when empty, so the slug card never waits on it.
 */
export function HomeDocuments({ userId, onSeeAll }: HomeDocumentsProps) {
  const router = useRouter()
  const { data } = useOwnerDocuments(
    { userId, searchQuery: '', sortKey: 'lastOpenedAt_desc' },
    { refetchOnWindowFocus: 'always' }
  )
  const firstPage = data?.pages[0]
  const docs = firstPage?.docs.slice(0, HOME_DOCUMENTS_LIMIT) ?? []

  if (docs.length === 0) return null

  return (
    <section
      aria-labelledby="home-documents-heading"
      className="rounded-box bg-base-100 border-base-300 mt-4 border p-3 motion-safe:animate-[doc-content-in_180ms_ease-out_both] sm:mt-6 sm:p-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <h2 id="home-documents-heading" className="text-base-content text-sm font-semibold">
          Documents
        </h2>
        {(firstPage?.total ?? 0) > HOME_DOCUMENTS_LIMIT && (
          <Button variant="ghost" size="xs" className="text-primary" onClick={onSeeAll}>
            See all
          </Button>
        )}
      </div>
      <ul>
        {docs.map((doc) => (
          <li key={doc.documentId}>
            <button
              type="button"
              onClick={() => router.push(`/${doc.slug}`)}
              className="rounded-field hover:bg-base-200 focus-visible:ring-primary flex w-full min-w-0 items-center gap-3 px-2 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
              <LuFileText size={18} className="text-base-content/40 shrink-0" />
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="text-base-content truncate text-sm font-medium">
                  {doc.title || doc.slug}
                </span>
                {doc.isFavorite && (
                  <LuStar
                    size={13}
                    className="text-accent fill-accent shrink-0"
                    aria-label="Favorite"
                  />
                )}
              </span>
              <span className="text-base-content/60 shrink-0 text-xs">
                {documentListDate(doc, 'lastOpenedAt_desc')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
