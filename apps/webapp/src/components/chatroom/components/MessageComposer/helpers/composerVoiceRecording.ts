let discardVoiceNote: (() => void) | null = null

export function registerComposerVoiceDiscard(fn: (() => void) | null): void {
  discardVoiceNote = fn
}

export function discardComposerVoiceNote(): void {
  discardVoiceNote?.()
}
