import { Moon, Sun } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useApp()
  const dark = theme === 'dark'
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
