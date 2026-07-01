let stopVoiceRecording: (() => void) | null = null

export function registerComposerVoiceStop(fn: (() => void) | null): void {
  stopVoiceRecording = fn
}

export function stopComposerVoiceRecording(): void {
  stopVoiceRecording?.()
}
