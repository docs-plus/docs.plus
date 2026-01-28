/**
 * CodeBlock Component
 * ===================
 * Displays code with syntax highlighting and copy functionality.
 */

import { MdContentCopy, MdCheck } from 'react-icons/md'
import { useDesignSystemDocs } from '../../context/DesignSystemDocsContext'

interface CodeBlockProps {
  code: string
  language?: string
  title?: string
  showLineNumbers?: boolean
}

export const CodeBlock = ({
  code,
  language = 'tsx',
  title,
  showLineNumbers = false
}: CodeBlockProps) => {
  const { copyToClipboard, copiedText } = useDesignSystemDocs()
  const isCopied = copiedText === code

  const handleCopy = () => {
    copyToClipboard(code)
  }

  const lines = code.trim().split('\n')

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400 uppercase">
            {language}
          </span>
        </div>
      )}

      {/* Code */}
      <div className="relative overflow-x-auto p-4">
        <pre className="text-sm leading-relaxed">
          <code className="text-slate-100">
            {showLineNumbers
              ? lines.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="mr-4 w-6 shrink-0 text-right text-slate-500 select-none">
                      {i + 1}
                    </span>
                    <span>{line || ' '}</span>
                  </div>
                ))
              : code.trim()}
          </code>
        </pre>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 rounded-lg border border-slate-600 bg-slate-800 p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-700"
          title="Copy code">
          {isCopied ? (
            <MdCheck size={16} className="text-success" />
          ) : (
            <MdContentCopy size={16} className="text-slate-400" />
          )}
        </button>
      </div>
    </div>
  )
}
