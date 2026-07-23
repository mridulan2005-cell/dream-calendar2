import { Bell, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ProfileMenu from './ProfileMenu.jsx'
import LanguageToggle from './LanguageToggle.jsx'
import crest from '../assets/iitb-crest.png'

// The Department Timetable's own page chrome: a white band across the top with a
// back control, the institute crest, and the page title — the title leading in
// the accent teal, the institute name sitting beneath it — with the account
// controls opposite (notifications, the account avatar, and the En/Hi switch).
// It replaces the app-wide "My IITB" persona bar on this surface — the timetable
// is a destination in its own right, not a tab.
export default function DeptHeader() {
  const navigate = useNavigate()

  return (
    <header className="z-40 flex h-16 shrink-0 items-center justify-between bg-surface px-6 shadow-[0_2px_6px_rgba(0,0,0,0.08)] dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          title="Back"
          aria-label="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition hover:text-accent dark:text-slate-300"
        >
          <ChevronLeft size={22} />
        </button>
        <img src={crest} alt="" className="h-9 w-9 shrink-0 object-contain" />
        <div className="flex min-w-0 flex-col tracking-[-0.3px]">
          <span className="text-h3-bold truncate text-accent">Department Timetable</span>
          <span className="text-body2-regular truncate text-slate-500 dark:text-slate-400">
            Indian Institute of Technology Bombay
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-5">
        <button
          title="Notifications"
          aria-label="Notifications"
          className="flex items-center justify-center text-slate-600 transition hover:text-accent dark:text-slate-300"
        >
          <Bell size={17} />
        </button>
        <ProfileMenu variant="avatar" />
        <LanguageToggle />
      </div>
    </header>
  )
}
