import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  FolderKanban,
  CalendarDays,
  Users,
  GraduationCap,
  CalendarRange,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import { useRole, ROLES } from '../store/RoleContext.jsx'

// The Faculty workspace's left navigation — the "My IITB" rail. Shared by the
// faculty layout and the embedded Master Timetable so the nav stays consistent.
const SECTIONS = [
  {
    title: 'My Workspace',
    items: [
      { label: 'Courses', to: '/faculty/courses', icon: BookOpen },
      { label: 'Projects', to: '/faculty/projects', icon: FolderKanban },
      { label: 'Schedule', to: '/faculty/schedule', icon: CalendarDays },
    ],
  },
  {
    title: 'General',
    items: [
      { label: 'Students', to: '/faculty/students', icon: Users },
      { label: 'Curriculum', to: '/faculty/curriculum', icon: GraduationCap },
      { label: 'Timetable', to: '/faculty/timetable', icon: CalendarRange },
    ],
  },
]

// The nav width is user-adjustable by dragging its right edge, within a fixed
// range, and the chosen width persists in localStorage so it carries across every
// faculty surface (the workspace pages and the embedded Master Timetable).
const WIDTH_KEY = 'iitb-faculty-nav-width'
const MIN_WIDTH = 160
const MAX_WIDTH = 340
const DEFAULT_WIDTH = 208
const clampWidth = (w) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w))
const readWidth = () => {
  if (typeof localStorage === 'undefined') return DEFAULT_WIDTH
  const raw = Number(localStorage.getItem(WIDTH_KEY))
  return Number.isFinite(raw) && raw > 0 ? clampWidth(raw) : DEFAULT_WIDTH
}

export default function FacultySideNav() {
  const [width, setWidth] = useState(readWidth)
  const [dragging, setDragging] = useState(false)
  const asideRef = useRef(null)

  // Drag the right edge to resize. We track the pointer globally while a drag is
  // in progress so the cursor can leave the thin handle without dropping it.
  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const left = asideRef.current?.getBoundingClientRect().left ?? 0
      setWidth(clampWidth(e.clientX - left))
    }
    const stop = () => setDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', stop)
    // Suppress text selection / cursor flicker while dragging.
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', stop)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [dragging])

  // Persist the width once a drag settles.
  useEffect(() => {
    if (dragging) return
    try {
      localStorage.setItem(WIDTH_KEY, String(width))
    } catch {
      /* storage may be unavailable — non-fatal */
    }
  }, [dragging, width])

  return (
    <aside
      ref={asideRef}
      style={{ width }}
      className="relative hidden shrink-0 flex-col gap-5 border-r border-slate-200 bg-surface px-3 py-5 dark:border-slate-800 dark:bg-slate-900 md:flex"
    >
      <div className="flex flex-1 flex-col gap-5">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {s.title}
            </div>
            <nav className="flex flex-col gap-0.5">
              {s.items.map((it) => {
                const Icon = it.icon
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                        isActive
                          ? 'bg-accent-soft text-accent dark:bg-slate-800 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Pinned to the bottom: a minimal switcher to view the app as a different
          kind of user (the coordinator, a faculty member, or a student). */}
      <RoleSwitcher />

      {/* Drag handle on the right edge — resize the nav within [min, max]. */}
      <div
        onMouseDown={onPointerDown}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
        title="Drag to resize · double-click to reset"
        role="separator"
        aria-orientation="vertical"
        className="group absolute inset-y-0 right-0 z-10 w-2 translate-x-1/2 cursor-col-resize"
      >
        <div
          className={`mx-auto h-full w-px transition-colors ${
            dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/50'
          }`}
        />
      </div>
    </aside>
  )
}

// A compact "viewing as …" control. Tapping it opens a small upward popover to
// pick the active role; the choice drives how the Timetable view renders.
function RoleSwitcher() {
  const { role, setRole } = useRole()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = ROLES.find((r) => r.id === role) || ROLES[0]

  // Dismiss on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const menu = (
    <div className="absolute bottom-full left-1 right-1 z-20 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        View as
      </div>
      {ROLES.map((r) => {
        const active = r.id === role
        return (
          <button
            key={r.id}
            onClick={() => {
              setRole(r.id)
              setOpen(false)
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
              active
                ? 'bg-accent-soft text-accent dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{r.label}</span>
              <span className="block truncate text-[11px] text-slate-400">{r.desc}</span>
            </span>
            {active && <Check size={15} className="shrink-0" />}
          </button>
        )
      })}
    </div>
  )

  return (
    <div ref={ref} className="relative px-1">
      {open && menu}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch the user you're viewing as"
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 transition ${
          open
            ? 'border-accent bg-accent-soft dark:border-slate-600 dark:bg-slate-800'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
        }`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-bold text-accent dark:bg-slate-700 dark:text-slate-200">
          {current.label.charAt(0)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[10px] uppercase tracking-wide text-slate-400">Viewing as</span>
          <span className="block truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
            {current.label}
          </span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-slate-400" />
      </button>
    </div>
  )
}
