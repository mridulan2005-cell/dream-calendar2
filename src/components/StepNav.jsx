import { useNavigate } from 'react-router-dom'
import { Lock, ChevronLeft, Check, BookOpen, Users, CalendarClock, MapPin, Sparkles } from 'lucide-react'
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
export default function StepNav({ steps, active, onSelect, stats, progress }) {
  const navigate = useNavigate()
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 px-4 py-6 dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={() => navigate('/experience')}
        className="mb-6 flex items-center gap-1 px-2 text-xs font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
      >
        <ChevronLeft size={14} /> IITB Experience
      </button>

      <div className="mb-7 border-b border-slate-200 px-2 pb-5 dark:border-slate-800">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Institute Planner
        </div>
        <div className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
          Timetable Gen
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Planner steps">
        {steps.map((s) => {
          const isActive = s.id === active
          const disabled = s.locked
          return (
            <button
              key={s.id}
              disabled={disabled}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => !disabled && onSelect(s.id)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
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
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-300 dark:border-slate-700 dark:text-slate-600">
        <Lock size={12} />
      </span>
    )
  }
  if (done) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
        <Check size={14} />
      </span>
    )
  }
  const Icon = STEP_ICONS[id] || BookOpen
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
        active
          ? 'bg-accent text-white'
          : 'border border-slate-300 text-slate-500 group-hover:border-accent group-hover:text-accent dark:border-slate-600 dark:text-slate-300'
      }`}
    >
      <Icon size={14} />
    </span>
  )
}
