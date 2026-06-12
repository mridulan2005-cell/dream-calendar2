import { Moon, Sun } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'

export default function ThemeToggle({ collapsed = false }) {
  const { theme, toggleTheme } = useApp()
  const dark = theme === 'dark'
  if (collapsed) {
    return (
      <button
        onClick={toggleTheme}
        title={dark ? 'Light mode' : 'Dark mode'}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    )
  }
  return (
    <button
      onClick={toggleTheme}
      className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
