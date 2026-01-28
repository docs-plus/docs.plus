/**
 * ComponentCard Component
 * =======================
 * Displays a component example with preview and code.
 */

import { useState, ReactNode } from 'react'
import { MdCode, MdVisibility, MdContentCopy, MdCheck } from 'react-icons/md'
import { useDesignSystemDocs } from '../../context/DesignSystemDocsContext'

interface ComponentCardProps {
  title: string
  description?: string
  children: ReactNode
  code: string
  importStatement?: string
  useWhen?: string[]
  avoidWhen?: string[]
}

export const ComponentCard = ({
  title,
  description,
  children,
  code,
  importStatement,
  useWhen,
  avoidWhen
}: ComponentCardProps) => {
  const [showCode, setShowCode] = useState(false)
  const { copyToClipboard, copiedText } = useDesignSystemDocs()

  const fullCode = importStatement ? `${importStatement}\n\n${code}` : code
  const isCopied = copiedText === fullCode

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCode(!showCode)}
            className={`btn btn-ghost btn-sm gap-1.5 ${showCode ? 'bg-slate-100' : ''}`}>
            {showCode ? <MdVisibility size={16} /> : <MdCode size={16} />}
            <span className="hidden sm:inline">{showCode ? 'Preview' : 'Code'}</span>
          </button>
          <button
            onClick={() => copyToClipboard(fullCode)}
            className="btn btn-ghost btn-sm"
            title="Copy code">
            {isCopied ? (
              <MdCheck size={16} className="text-success" />
            ) : (
              <MdContentCopy size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Preview / Code */}
      <div className="min-h-24 p-4">
        {showCode ? (
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
            <code>{fullCode.trim()}</code>
          </pre>
        ) : (
          <div className="flex flex-wrap items-center gap-3">{children}</div>
        )}
      </div>

      {/* Guidelines */}
      {(useWhen || avoidWhen) && (
        <div className="grid gap-4 border-t border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
          {useWhen && (
            <div>
              <p className="text-success mb-2 text-xs font-semibold tracking-wide uppercase">
                ✓ Use when
              </p>
              <ul className="space-y-1 text-sm text-slate-600">
                {useWhen.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {avoidWhen && (
            <div>
              <p className="text-error mb-2 text-xs font-semibold tracking-wide uppercase">
                ✗ Avoid when
              </p>
              <ul className="space-y-1 text-sm text-slate-600">
                {avoidWhen.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
