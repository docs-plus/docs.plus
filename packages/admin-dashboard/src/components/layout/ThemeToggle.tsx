import { LuSun, LuMoon } from 'react-icons/lu'
import { useUIStore } from '@/stores/uiStore'

export function ThemeToggle() {
  const { theme, toggleTheme } = useUIStore()
  const isDark = theme === 'docsplus-dark'

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost btn-sm btn-square"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? <LuSun className="h-5 w-5" /> : <LuMoon className="h-5 w-5" />}
    </button>
  )
}
