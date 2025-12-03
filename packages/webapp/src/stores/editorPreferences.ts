import { StateCreator } from 'zustand'
import { persist, PersistOptions } from 'zustand/middleware'
import { create } from 'zustand'

type EditorPreferences = {
  indentHeading: boolean
  h1SectionBreak: boolean
}

export interface IEditorPreferencesStore {
  preferences: EditorPreferences
  setPreference: <K extends keyof EditorPreferences>(key: K, value: EditorPreferences[K]) => void
  togglePreference: (key: keyof EditorPreferences) => void
  hydrated: boolean
  setHydrated: (state: boolean) => void
}

type EditorPreferencesPersist = (
  config: StateCreator<IEditorPreferencesStore>,
  options: PersistOptions<IEditorPreferencesStore>
) => StateCreator<IEditorPreferencesStore>

export const useEditorPreferences = create<IEditorPreferencesStore>(
  (persist as EditorPreferencesPersist)(
    (set) => ({
      preferences: {
        indentHeading: false,
        h1SectionBreak: true
      },
      hydrated: false,
      setHydrated: (state) => set({ hydrated: state }),
      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value }
        })),
      togglePreference: (key) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: !state.preferences[key] }
        }))
    }),
    {
      name: 'editor-preferences',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      }
    }
  )
)

// Apply CSS classes based on preferences - call this on app init and preference changes
export const applyEditorPreferences = (preferences: EditorPreferences) => {
  if (typeof document === 'undefined') return

  document.body.classList.toggle('indentHeading', preferences.indentHeading)
  document.body.classList.toggle('h1SectionBreak', preferences.h1SectionBreak)
}
