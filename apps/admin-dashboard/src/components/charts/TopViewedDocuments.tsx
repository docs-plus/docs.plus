import { LuEye, LuFileText, LuUsers } from 'react-icons/lu'

import { APP_URL } from '@/constants/config'
import type { TopViewedDocument } from '@/types'

// `document_slug` is the analytics key (lower(documentId)), never a URL segment.
// The API resolves `slug`, the human path, and leaves it null when no document
// metadata row exists. Declared here until the shared type carries it.
type TopViewedDocumentRow = TopViewedDocument & { slug?: string | null }

interface TopViewedDocumentsProps {
  data: TopViewedDocumentRow[]
  loading?: boolean
  limit?: number
}

export function TopViewedDocuments({ data, loading, limit = 5 }: TopViewedDocumentsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-8 w-8 rounded-lg" />
            <div className="flex-1">
              <div className="skeleton mb-1 h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
            <div className="skeleton h-6 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="text-base-content/50 flex flex-col items-center justify-center py-8">
        <LuFileText className="mb-2 h-12 w-12 opacity-30" />
        <p>No documents viewed yet</p>
      </div>
    )
  }

  const displayData = data.slice(0, limit)

  return (
    <div className="space-y-3">
      {displayData.map((doc, index) => {
        const row = (
          <>
            <div className="bg-base-200 text-base-content/70 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
              {index + 1}
            </div>

            <div className="min-w-0 flex-1">
              <p className="group-hover:text-primary truncate font-medium transition-colors">
                {doc.title || doc.document_slug}
              </p>
              <div className="text-base-content/50 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <LuEye className="h-3 w-3" />
                  {(doc.views ?? 0).toLocaleString()} views
                </span>
                <span className="flex items-center gap-1">
                  <LuUsers className="h-3 w-3" />
                  {(doc.unique_users ?? doc.unique_visitors ?? 0).toLocaleString()} visitors
                </span>
              </div>
            </div>

            <div className="badge badge-primary badge-outline">
              {(doc.views ?? 0).toLocaleString()}
            </div>
          </>
        )

        return doc.slug ? (
          <a
            key={doc.document_slug}
            href={`${APP_URL}/${doc.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-base-200 group -mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors">
            {row}
          </a>
        ) : (
          <div
            key={doc.document_slug}
            className="-mx-2 flex items-center gap-3 rounded-lg p-2"
            title="No document record — nothing to open">
            {row}
          </div>
        )
      })}
    </div>
  )
}
