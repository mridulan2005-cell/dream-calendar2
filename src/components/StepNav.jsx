import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lock,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  BookOpen,
  Users,
  CalendarClock,
  MapPin,
  Sparkles,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

// A meaningful icon per planner step, keyed by step id.
const STEP_ICONS = {
  courses: BookOpen,
  faculty: Users,
  slot: CalendarClock,
  venue: MapPin,
  generate: Sparkles,
}

// Vertical stepper that doubles as the planner's primary navigation.
// Each item is now a free-access nav item with no visible step number.
// The rail collapses to a slim icon strip to reclaim horizontal space.
// `bare` drops the panel chrome (own title, border, filled background) so the
// rail blends as a plain left column under a shared header — used on the Master
// Timetable, which already carries the department-timetable banner above it.
export default function StepNav({ steps, active, onSelect, stats, progress, embedded = false, bare = false }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <aside
        className={`flex w-16 shrink-0 flex-col items-center py-6 ${
          bare
            ? 'bg-transparent'
            : 'border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
        }`}
      >
        <button
          onClick={() => setCollapsed(false)}
          title="Expand navigation"
          aria-label="Expand navigation"
          className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <PanelLeftOpen size={18} />
        </button>
        <nav className="flex flex-1 flex-col items-center gap-2" aria-label="Planner steps">
          {steps.map((s) => {
            const isActive = s.id === active
            const disabled = s.locked
            const pending = progress && progress[s.id] && progress[s.id].total - progress[s.id].done > 0
            return (
              <button
                key={s.id}
                disabled={disabled}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => !disabled && onSelect(s.id)}
                title={s.label}
                aria-label={s.label}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  isActive
                    ? 'bg-accent-soft dark:bg-slate-800'
                    : disabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <StepMarker id={s.id} done={s.done} active={isActive} locked={disabled} />
                {pending && !s.done && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-slate-50 dark:ring-slate-900" />
                )}
              </button>
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
    <aside
      className={`flex w-52 shrink-0 flex-col px-3 py-5 ${
        bare
          ? 'bg-transparent'
          : 'border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      {/* Title at the very top; the collapse control sits inline with it. In
          `bare` mode the shared banner above supplies the heading, so the rail
          shows just the collapse control with no title or divider. */}
      <div className={`px-2 ${bare ? 'mb-2' : 'mb-5 border-b border-slate-200 pb-4 dark:border-slate-800'}`}>
        {!embedded && !bare && (
          <button
            onClick={() => navigate('/experience')}
            className="text-body2-regular mb-2 flex items-center gap-1 font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ChevronLeft size={12} /> IITB Experience
          </button>
        )}
        <div className="flex items-start justify-between gap-2">
          {!bare && (
            <div className="min-w-0">
              <div className="text-h3-bold truncate text-slate-800 dark:text-slate-100">Timetable Gen</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse navigation"
            aria-label="Collapse navigation"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${
              bare ? 'ml-auto' : '-mr-1'
            }`}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Planner steps">
        {steps.map((s) => {
          const isActive = s.id === active
          const disabled = s.locked
          return (
            <button
              key={s.id}
              disabled={disabled}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => !disabled && onSelect(s.id)}
              className={`group text-body1-medium flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                isActive
                  ? 'bg-accent-soft text-slate-900 dark:bg-slate-800 dark:text-white'
                  : disabled
                    ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <StepMarker id={s.id} done={s.done} active={isActive} locked={disabled} />
              <span className="flex-1 leading-tight">
                {s.label}
              </span>
              {progress && progress[s.id] ? (
                <div className="flex flex-col items-end text-right">
                  <span className={`text-xs font-bold leading-none ${progress[s.id].total - progress[s.id].done > 0 ? "text-amber-500" : "text-green-500 dark:text-green-400"}`}>
                    {progress[s.id].done}/{progress[s.id].total}
                  </span>
                </div>
              ) : null}
            </button>
          )
        })}
      </nav>
      <div className="mt-3">
        <ThemeToggle />
      </div>
    </aside>
  )
}

// The marker on the left of each step: the step's own icon, or a lock / check
// when the step is locked or finalised.
function StepMarker({ id, done, active, locked }) {
  if (locked) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-300 dark:border-slate-700 dark:text-slate-600">
        <Lock size={11} />
      </span>
    )
  }
  if (done) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
        <Check size={13} />
      </span>
    )
  }
  const Icon = STEP_ICONS[id] || BookOpen
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
        active
          ? 'bg-accent text-white'
          : 'border border-slate-300 text-slate-500 group-hover:border-accent group-hover:text-accent dark:border-slate-600 dark:text-slate-300'
      }`}
    >
      <Icon size={13} />
    </span>
  )
}
