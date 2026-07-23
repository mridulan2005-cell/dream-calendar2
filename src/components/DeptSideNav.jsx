import { BookOpen, Users, CalendarClock, MapPin, Sparkles } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { buildSteps } from '../logic/plannerSteps.js'
import { progress } from '../logic/timetable.js'

// A meaningful icon per planner step, keyed by step id.
const STEP_ICONS = {
  courses: BookOpen,
  faculty: Users,
  slot: CalendarClock,
  venue: MapPin,
  generate: Sparkles,
}

// The Department Timetable's left rail (Figma node 142:915): the planner's own
// steps, drawn as a flat list on white with the active item outlined rather than
// filled. It sits at the page edge under the header — replacing both the "My
// IITB" faculty rail and the in-content step rail, so the page has exactly one
// navigation and the design's chrome reads end-to-end.
export default function DeptSideNav({ faculty = false }) {
  const { courses, workflow, activeStep, setActiveStep } = useApp()
  const steps = buildSteps(workflow)
  // How far each allotment step has got, as done/total. Only the three allotment
  // steps have a count to give: "Running Courses" is the course list itself, and
  // the Master Timetable is the output, so neither has a denominator. The
  // department-wide count is the coordinator's concern — a faculty member sees
  // the same steps without it, since they're here for their own courses.
  const p = faculty ? {} : progress(courses)

  return (
    <aside className="hidden w-[204px] shrink-0 flex-col bg-surface py-6 shadow-[4px_0_8px_rgba(0,0,0,0.06)] dark:bg-slate-900 md:flex">
      <nav className="flex flex-col gap-1.5" aria-label="Timetable steps">
        {steps.map((s) => {
          const isActive = s.id === activeStep
          const Icon = STEP_ICONS[s.id] || BookOpen
          const stat = p[s.id]
          const pending = stat && stat.total - stat.done > 0
          return (
            <button
              key={s.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveStep(s.id)}
              title={stat ? `${s.label} — ${stat.done}/${stat.total} allotted` : s.label}
              className={`ml-[14px] flex w-[176px] items-center gap-2 rounded-lg border p-2 text-left text-[13px] font-medium tracking-[-0.3px] transition ${
                isActive
                  ? 'border-hairline text-heading dark:border-slate-600 dark:text-white'
                  : 'border-transparent text-idle hover:border-slate-200 hover:text-heading dark:hover:border-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {stat && (
                <span
                  className={`shrink-0 text-[10px] font-bold leading-none ${
                    pending ? 'text-amber-500' : 'text-green-500 dark:text-green-400'
                  }`}
                >
                  {stat.done}/{stat.total}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
