import { NavLink } from 'react-router-dom'
import { Bell, Settings } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'
import ProfileMenu from './ProfileMenu.jsx'

// The primary, app-wide navigation: a single bar of persona tabs (Today /
// Campus / Employee / Faculty / Head) centred over a soft mint canvas, with the
// account controls at the right. The institute branding header lives on the
// Department Timetable surface (see DeptHeader) — not on this landing chrome.
const TABS = [
  { id: 'today', label: 'Today', to: '/', end: true },
  { id: 'campus', label: 'Campus', to: '/campus' },
  { id: 'employee', label: 'Employee', to: '/employee' },
  { id: 'faculty', label: 'Faculty', to: '/faculty' },
  { id: 'head', label: 'Head', to: '/head' },
]

export default function TopNav() {
  return (
    <header className="z-40 flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-canvas px-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex-1" />

      <nav className="flex items-center gap-2">
        {TABS.map((t) => (
          <NavLink
            key={t.id}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `text-body1-medium rounded-full px-5 py-2 transition ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'border border-slate-200 bg-surface text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-3">
        <ThemeToggle collapsed />
        <button
          title="Settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-accent dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Settings size={17} />
        </button>
        <button
          title="Notifications"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-accent dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Bell size={17} />
        </button>
        <ProfileMenu />
      </div>
    </header>
  )
}
