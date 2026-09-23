import type { DocSelectionRange } from '@components/TipTap/hyperlinkPopovers/types'
import type { HyperlinkAttributes } from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'

export type ComposerLinkPhase = 'idle' | 'preview' | 'create' | 'edit'

export type ComposerLinkPreviewPayload = {
  href: string
  editor: Editor
  nodePos: number
  validate?: (url: string) => boolean
}

export type ComposerLinkCreatePayload = {
  editor: Editor
  extensionName: string
  attributes: Partial<HyperlinkAttributes>
  validate?: (url: string) => boolean
  initialHref: string
  initialText: string
  selection?: DocSelectionRange
}

export type ComposerLinkEditPayload = {
  editor: Editor
  nodePos: number
  validate?: (url: string) => boolean
  initialHref: string
  initialText: string
  returnToPreview?: ComposerLinkPreviewPayload
}

export type ComposerModeKind = 'none' | 'reply' | 'edit' | 'comment'

export type ComposerModeEdge = {
  to: ComposerModeKind
  draftLoad: 'keep' | 'fill' | 'replace'
  discardModeAdded: boolean
}

type VoicePoint = { x: number; y: number }

/** Its object identity marks the current microphone request. */
export type VoiceMicRequest = { anchor: VoicePoint; locked: boolean }

export type VoiceNoteState =
  | { phase: 'idle'; request: VoiceMicRequest | null; releasedEarly: boolean }
  | {
      phase: 'recording'
      anchor: VoicePoint
      startedAt: number
      locked: boolean
      cancelArmed: boolean
      stopping: 'send' | 'preview' | null
    }
  | { phase: 'preview'; file: File }

export type VoiceNoteEvent =
  | { type: 'press'; x: number; y: number; locked: boolean }
  | { type: 'micGranted'; request: VoiceMicRequest; stream: MediaStream; now: number }
  | { type: 'micRefused'; request: VoiceMicRequest }
  | { type: 'move'; x: number; y: number }
  | { type: 'release'; now: number }
  | { type: 'stop' }
  | { type: 'recorderStopped'; file: File | null }
  | { type: 'sendPreview' }
  | { type: 'discard' }

export type VoiceNoteEffect =
  | { type: 'requestMic'; request: VoiceMicRequest }
  | { type: 'dropStream'; stream: MediaStream }
  | { type: 'record'; stream: MediaStream; startedAt: number }
  | { type: 'drag'; x: number; y: number }
  | { type: 'haptic' }
  | { type: 'hint' }
  | { type: 'micError' }
  | { type: 'stopRecorder' }
  | { type: 'send'; file: File }
  | { type: 'openPreview'; file: File }
  | { type: 'teardown' }
