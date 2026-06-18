import { NavLink } from 'react-router-dom'
import { CalendarDays, Image, Users, Star, Folder, FolderClosed, GraduationCap } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

const items = [
  { label: 'Today', icon: CalendarDays, badge: '24', to: '#today' },
  { label: 'Campusites', icon: Image, to: '#campusites' },
  { label: 'IITB Employees', icon: Users, to: '#employees' },
  { label: 'Faculty Members: IDC', icon: Star, to: '#faculty' },
  { label: 'Programme Curriculum', icon: GraduationCap, to: '/curriculum', primary: true },
  { label: 'Department Timetable', icon: Folder, to: '/planner', primary: true },
  { label: 'Blank', icon: FolderClosed, to: '#blank' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 px-4 py-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-8 flex items-center justify-between px-3">
        <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          IITB Experience
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const content = (active) => (
            <span
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-accent-soft text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-xs text-slate-400">{item.badge}</span>
              )}
            </span>
          )
          return item.primary ? (
            <NavLink key={item.label} to={item.to}>
              {({ isActive }) => content(isActive)}
            </NavLink>
          ) : (
            <a key={item.label} href={item.to}>
              {content(false)}
            </a>
          )
        })}
      </nav>

      <ThemeToggle />
    </aside>
  )
}
