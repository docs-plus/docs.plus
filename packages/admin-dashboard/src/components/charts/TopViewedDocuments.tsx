import { LuFileText, LuUsers, LuEye } from 'react-icons/lu';
import type { TopViewedDocument } from '@/types';
import { APP_URL } from '@/constants/config';

interface TopViewedDocumentsProps {
  data: TopViewedDocument[];
  loading?: boolean;
  limit?: number;
}

export function TopViewedDocuments({ data, loading, limit = 5 }: TopViewedDocumentsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="flex-1">
              <div className="skeleton h-4 w-3/4 mb-1" />
              <div className="skeleton h-3 w-1/2" />
            </div>
            <div className="skeleton h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-base-content/50">
        <LuFileText className="h-12 w-12 mb-2 opacity-30" />
        <p>No documents viewed yet</p>
      </div>
    );
  }

  const displayData = data.slice(0, limit);

  return (
    <div className="space-y-3">
      {displayData.map((doc, index) => (
        <a
          key={doc.document_slug}
          href={`${APP_URL}/${doc.document_slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-base-200 transition-colors group"
        >
          {/* Rank */}
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-base-200 text-sm font-bold text-base-content/70">
            {index + 1}
          </div>

          {/* Document info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              {doc.title || doc.document_slug}
            </p>
            <div className="flex items-center gap-3 text-xs text-base-content/50">
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

          {/* Views badge */}
          <div className="badge badge-primary badge-outline">
            {(doc.views ?? 0).toLocaleString()}
          </div>
        </a>
      ))}
    </div>
  );
}
