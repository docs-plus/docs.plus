const TOOLBAR_TOGGLE_KEY = 'docsy_toolbar_toggle'

export const toolbarStorage = {
  get: (): boolean => {
    if (typeof window === 'undefined') return false

    try {
      const stored = localStorage.getItem(TOOLBAR_TOGGLE_KEY)
      return stored ? JSON.parse(stored) : false
    } catch (error) {
      console.warn('Failed to read toolbar toggle from localStorage:', error)
      return false
    }
  },

  set: (value: boolean): void => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(TOOLBAR_TOGGLE_KEY, JSON.stringify(value))
    } catch (error) {
      console.warn('Failed to save toolbar toggle to localStorage:', error)
    }
  },

  remove: (): void => {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(TOOLBAR_TOGGLE_KEY)
    } catch (error) {
      console.warn('Failed to remove toolbar toggle from localStorage:', error)
    }
  }
}
