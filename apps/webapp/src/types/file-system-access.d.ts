// TypeScript's DOM lib has the file handle but not the picker. Optional, because
// only Chromium ships it and every caller must feature-check.
interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}
