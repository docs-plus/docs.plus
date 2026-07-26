import {
  type ConversionWarning,
  exportDocument,
  type ExportFormat,
  importDocument,
  type ImportedDocument
} from '@api'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { Icons } from '@icons'
import type { Editor } from '@tiptap/core'
import React, { useState } from 'react'

import { sanitizeJsonContent } from '../../extensions/markdown-paste/markdownPastePlugin'

interface ImportExportSectionProps {
  editor: Editor | null | undefined
  documentId: string
  documentTitle: string
  /** The read-only lock and the owner gate, already resolved by the panel. */
  editingLocked: boolean
  isSheet: boolean
  onPrint: () => void
}

const EXPORT_ROWS = [
  { id: 'docx', icon: Icons.fileText, name: 'Word', hint: '.docx' },
  { id: 'md', icon: Icons.code, name: 'Markdown', hint: '.md' },
  // Word and OpenDocument share a glyph on purpose — the registry has no per-format
  // icon, and the label plus extension already separates them.
  { id: 'odt', icon: Icons.fileText, name: 'OpenDocument', hint: '.odt' },
  {
    id: 'print',
    icon: Icons.print,
    name: 'Print / Save as PDF',
    hint: 'Opens your browser’s print dialog'
  }
] as const

type RowId = (typeof EXPORT_ROWS)[number]['id']

type ImportStage =
  | { step: 'idle' }
  | { step: 'converting'; filename: string }
  | { step: 'staged'; filename: string; result: ImportedDocument }
  | { step: 'applying'; filename: string; result: ImportedDocument }
  | { step: 'done'; filename: string; warnings: ConversionWarning[] }
  | { step: 'failed'; message: string }

// A malformed Word file can produce dozens of mammoth messages, and the panel is 28rem wide.
const WARNINGS_SHOWN = 5

const WarningList = ({
  heading,
  warnings,
  onDismiss
}: {
  heading: string
  warnings: ConversionWarning[]
  onDismiss?: () => void
}) => (
  <div className="border-warning/30 bg-warning/10 rounded-box mt-3 border p-3" role="status">
    <div className="flex items-start gap-2.5">
      <Icons.alert size={16} className="text-warning mt-0.5 shrink-0" />
      <p className="text-base-content min-w-0 flex-1 text-sm font-medium">{heading}</p>
      {onDismiss ? <CloseButton onClick={onDismiss} size="xs" /> : null}
    </div>
    <ul className="text-base-content/70 mt-1.5 list-disc space-y-1 pl-8 text-xs">
      {warnings.slice(0, WARNINGS_SHOWN).map((warning, index) => (
        <li key={`${warning.code}-${index}`}>{warning.message}</li>
      ))}
      {warnings.length > WARNINGS_SHOWN ? <li>{warnings.length - WARNINGS_SHOWN} more.</li> : null}
    </ul>
  </div>
)

const ImportExportSection = ({
  editor,
  documentId,
  documentTitle,
  editingLocked,
  isSheet,
  onPrint
}: ImportExportSectionProps) => {
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null)
  const [savedFormat, setSavedFormat] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [stage, setStage] = useState<ImportStage>({ step: 'idle' })

  const canExport = Boolean(editor) && Boolean(documentTitle || !editor?.isEmpty)
  const touchHeight = isSheet ? 'min-h-11' : ''

  const runExport = async (format: ExportFormat) => {
    setExportError(null)
    setBusyFormat(format)
    try {
      await exportDocument(documentId, format, documentTitle || 'document')
      setSavedFormat(format)
      setTimeout(() => setSavedFormat(null), 2000)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setBusyFormat(null)
    }
  }

  const convert = async (file: File) => {
    setStage({ step: 'converting', filename: file.name })
    try {
      const result = await importDocument(documentId, file)
      setStage({ step: 'staged', filename: file.name, result })
    } catch (error) {
      setStage({
        step: 'failed',
        message: error instanceof Error ? error.message : 'Import failed.'
      })
    }
  }

  // Synchronous to the click: iOS Safari revokes the gesture across an await, and
  // the picker then silently refuses to open.
  const pickFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.docx,.md'
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (file) void convert(file)
    })
    input.addEventListener('cancel', () => input.remove())
    input.click()
  }

  const applyStaged = (staged: Extract<ImportStage, { step: 'staged' }>) => {
    if (!editor) return
    setStage({ ...staged, step: 'applying' })
    try {
      editor.commands.setContent(sanitizeJsonContent(staged.result.content))
      setStage({ step: 'done', filename: staged.filename, warnings: staged.result.warnings })
    } catch {
      setStage({
        step: 'failed',
        message: 'The file was read, but the editor couldn’t accept it. Nothing changed.'
      })
    }
  }

  const rowTrailing = (id: RowId) => {
    if (id === 'print') return <Icons.print size={14} className="text-base-content/40 shrink-0" />
    if (busyFormat === id)
      return <span className="loading loading-spinner loading-xs text-primary" />
    if (savedFormat === id) return <Icons.check size={14} className="text-success shrink-0" />
    return <Icons.download size={14} className="text-base-content/40 shrink-0" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-base-content/50 text-[10px] font-medium tracking-wide uppercase">
          Export a copy
        </p>
        <div className="rounded-field border-base-300 divide-base-300 mt-2 divide-y overflow-hidden border">
          {EXPORT_ROWS.map((row) => (
            <button
              key={row.id}
              type="button"
              disabled={row.id === 'print' ? !editor : !canExport || busyFormat !== null}
              onClick={() => (row.id === 'print' ? onPrint() : void runExport(row.id))}
              className="hover:bg-base-200 focus-visible:ring-primary flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:opacity-40 disabled:hover:bg-transparent">
              <span className="bg-base-300/40 text-base-content/70 rounded-field flex size-8 shrink-0 items-center justify-center">
                <row.icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-base-content block text-sm font-medium">{row.name}</span>
                <span className="text-base-content/60 block truncate text-xs">{row.hint}</span>
              </span>
              {rowTrailing(row.id)}
            </button>
          ))}
        </div>
        <p className="text-base-content/60 mt-2 text-xs">
          {canExport
            ? 'Exports use the last saved version, so something you typed a moment ago may not be in the file yet.'
            : 'Nothing to export yet — write something first and it’ll save on its own.'}
        </p>
        {exportError ? <p className="text-error mt-1.5 text-xs">{exportError}</p> : null}
      </div>

      <div className="border-base-300 border-t pt-4">
        <p className="text-base-content/50 text-[10px] font-medium tracking-wide uppercase">
          Replace with a file
        </p>

        {editingLocked ? (
          <p className="text-base-content/60 mt-2 text-xs">
            This document is read-only, so it can’t be replaced.
          </p>
        ) : null}

        {/* `done` stays here too, or a warning-free import leaves no way to import again. */}
        {!editingLocked && ['idle', 'failed', 'done'].includes(stage.step) ? (
          <>
            <p className="text-base-content/60 mt-2 text-xs">
              Word (.docx) or Markdown (.md). You’ll see what changes before anything is replaced.
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={!editor}
              startIcon={Icons.upload}
              className={`border-base-300 mt-2 w-full border ${touchHeight}`}
              onClick={pickFile}>
              Choose file…
            </Button>
          </>
        ) : null}

        {stage.step === 'converting' ? (
          <div className="rounded-box border-base-300 mt-2 flex items-center gap-2.5 border p-3">
            <span className="loading loading-spinner loading-xs text-primary" />
            <span className="text-base-content min-w-0 flex-1 truncate text-sm">
              Reading {stage.filename}…
            </span>
          </div>
        ) : null}

        {stage.step === 'staged' || stage.step === 'applying' ? (
          <div className="rounded-box border-base-300 mt-2 border p-3 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
            <div className="flex items-start gap-2.5">
              <Icons.fileText size={16} className="text-base-content/70 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-base-content truncate text-sm font-medium">{stage.filename}</p>
                <p className="text-base-content/60 mt-0.5 text-xs">
                  Title will be “{stage.result.title}”.
                </p>
              </div>
              {stage.step === 'staged' ? (
                <CloseButton onClick={() => setStage({ step: 'idle' })} size="xs" />
              ) : null}
            </div>

            {stage.result.warnings.length ? (
              <WarningList
                heading="Some things won’t survive the conversion:"
                warnings={stage.result.warnings}
              />
            ) : null}

            <p className="text-base-content/70 mt-3 text-sm">
              This replaces the whole document for everyone in it, right now, and there’s no undo.
              Heading chat rooms, folds and section links stop working — a file can’t carry the
              heading IDs they point at.
            </p>

            <div className="mt-3 flex gap-2">
              <Button
                variant="error"
                size="sm"
                loading={stage.step === 'applying'}
                className={`flex-1 ${touchHeight}`}
                onClick={() => stage.step === 'staged' && applyStaged(stage)}>
                Replace document
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={stage.step === 'applying'}
                className={`border-base-300 border ${touchHeight}`}
                onClick={() => setStage({ step: 'idle' })}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        {stage.step === 'done' ? (
          <>
            <p className="text-success mt-2 text-xs">Replaced with {stage.filename}.</p>
            {stage.warnings.length ? (
              <WarningList
                heading="Some things didn’t survive the conversion:"
                warnings={stage.warnings}
                onDismiss={() => setStage({ step: 'idle' })}
              />
            ) : null}
          </>
        ) : null}

        {stage.step === 'failed' ? (
          <p className="text-error mt-2 text-xs">{stage.message}</p>
        ) : null}
      </div>
    </div>
  )
}

export default ImportExportSection
