import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  Users,
  Star,
  Folder,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

const items = [
  { label: 'Today', icon: CalendarDays, badge: '24', to: '#today' },
  { label: 'IITB Employees', icon: Users, to: '#employees' },
  { label: 'Faculty Members: IDC', icon: Star, to: '#faculty' },
  { label: 'Programme Curriculum', icon: GraduationCap, to: '/faculty/curriculum', primary: true },
  { label: 'Department Timetable', icon: Folder, to: '/faculty/timetable', primary: true },
]

// The collapse preference is shared across every surface that renders the main
// nav (home, the planner, the slot-system editor), so it lives in localStorage.
const COLLAPSE_KEY = 'iitb-sidebar-collapsed'
const readCollapsed = () => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(COLLAPSE_KEY) === '1'
}

// The global IITB Experience nav. It now stays mounted inside the planner and
// the slot-system editor too, and can be collapsed to a slim icon strip to
// reclaim horizontal room (the planner has its own step rail beside it).
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* storage may be unavailable — non-fatal */
      }
      return next
    })
  }

  if (collapsed) {
    return (
      <aside className="flex w-16 shrink-0 flex-col items-center border-r border-slate-200 bg-surface py-6 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={toggle}
          title="Expand navigation"
          aria-label="Expand navigation"
          className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <PanelLeftOpen size={18} />
        </button>
        <nav className="flex flex-1 flex-col items-center gap-2">
          {items.map((item) => {
            const Icon = item.icon
            const marker = (active) => (
              <span
                title={item.label}
                aria-label={item.label}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  active
                    ? 'bg-accent-soft text-slate-900 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon size={18} />
              </span>
            )
            return item.primary ? (
              <NavLink key={item.label} to={item.to}>
                {({ isActive }) => marker(isActive)}
              </NavLink>
            ) : (
              <a key={item.label} href={item.to}>
                {marker(false)}
              </a>
            )
          })}
        </nav>
        <div className="mt-3">
          <ThemeToggle collapsed />
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-surface px-4 py-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-8 flex items-center justify-between px-3">
        <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          IITB Experience
        </span>
        <button
          onClick={toggle}
          title="Collapse navigation"
          aria-label="Collapse navigation"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <PanelLeftClose size={16} />
        </button>
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
