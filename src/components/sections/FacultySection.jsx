import { useMemo, useState } from 'react'
import { Check, Plus, X, Users } from 'lucide-react'
import { useApp } from '../../store/AppContext.jsx'
import { TERM, PREV_YEAR, faculty as allFaculty } from '../../data/seed.js'
import { matchesFilter, progress } from '../../logic/timetable.js'
import CourseFilters from '../CourseFilters.jsx'
import FacultyLoadPanel from '../FacultyLoadPanel.jsx'
import SectionHeader from './SectionHeader.jsx'
import StepShell from './StepShell.jsx'
import AeroSection from './AeroSection.jsx'
import MarkDoneButton from './MarkDoneButton.jsx'
import StatusFilter from './StatusFilter.jsx'

// Step 2 — assign teaching faculty per course, as cards. The right of each card
// shows who taught it last year (carried-over reference). A "Faculty load" panel
// opens alongside (not as a separate tab) so total teaching load is visible
// while assigning — no context switch.
export default function FacultySection({ nav, scope, setScope }) {
  const { courses, updateCourse, workflow, setStepDone } = useApp()
  const [filter, setFilter] = useState({ program: '', sub: '', query: '' })
  const [status, setStatus] = useState('all') // all | allotted | unallotted
  const [loadOpen, setLoadOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const isAllotted = (c) => c.faculty.length > 0

  const stat = progress(courses).faculty
  const complete = stat.done === stat.total
  const stepDone = workflow.facultyFinalised
  const q = filter.query.trim().toLowerCase()
  const list = useMemo(
    () =>
      courses.filter(
        (c) =>
          matchesFilter(c, filter.program, filter.sub) &&
          (!q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)),
      ),
    [courses, filter, q],
  )
  const allottedCount = list.filter(isAllotted).length
  const counts = { all: list.length, allotted: allottedCount, unallotted: list.length - allottedCount }
  const shown =
    status === 'all' ? list : list.filter((c) => (status === 'allotted' ? isAllotted(c) : !isAllotted(c)))

  const setFaculty = (course, next) => updateCourse({ ...course, faculty: next })

  // Read-only aero (B.Tech) view — placed after all hooks for stable hook order.
  if (scope?.departmentId && scope.departmentId !== 'idc') {
    return <AeroSection mode="faculty" nav={nav} scope={scope} setScope={setScope} />
  }

  return (
    <StepShell
      nav={nav}
      scope={scope}
      setScope={setScope}
      header={
        <SectionHeader
        eyebrow={`Department Timetable ${TERM.semester} 2026-27`}
        title="Faculty Allotment"
        action={
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                complete ? 'bg-ok-soft text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {stat.done} of {stat.total} allotted ({stat.total - stat.done} left)
            </span>
            <MarkDoneButton
              done={stepDone}
              complete={complete}
              remaining={stat.total - stat.done}
              onToggle={() => setStepDone('faculty', !stepDone)}
            />
          </div>
        }
        />
      }
    >
      <div className="mx-auto max-w-7xl">
      <div className="mt-5 flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <CourseFilters
            value={filter}
            onChange={setFilter}
            trailing={
              <button
                onClick={() => setLoadOpen((o) => !o)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  loadOpen
                    ? 'border-accent bg-accent-soft text-accent dark:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Users size={15} /> Faculty load
              </button>
            }
          />
          <div className="mt-4 flex items-center justify-between">
            <StatusFilter value={status} onChange={setStatus} counts={counts} />
            <span className="text-xs text-slate-400">
              <b className="text-slate-600 dark:text-slate-300">{allottedCount}</b> of {list.length}{' '}
              faculty allotted
            </span>
          </div>

          <div className="mt-3 space-y-3 pb-4">
            {shown.map((c) => (
              <div
                key={c.id}
                onMouseEnter={() => setHovered(c.faculty)}
                onMouseLeave={() => setHovered(null)}
                className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="min-w-0 flex-[1.4]">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {c.type} Course · {c.credits} Credits
                  </div>
                  <div className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">
                    <span className="text-slate-500 dark:text-slate-400">{c.code}</span>
                    <span className="mx-1.5 text-slate-300">|</span>
                    {c.title}
                  </div>
                </div>

                {/* Teaching-faculty editor */}
                <div className="flex-1">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Teaching faculty
                  </div>
                  <FacultyEditor
                    value={c.faculty}
                    onChange={(next) => setFaculty(c, next)}
                  />
                </div>

                {/* Last-year reference */}
                <div className="w-52 shrink-0 text-right text-xs leading-snug text-slate-400">
                  {c.faculty.length ? (
                    <>
                      Taught by{' '}
                      <span className="text-slate-500 dark:text-slate-300">{c.faculty.join(' & ')}</span> in{' '}
                      {PREV_YEAR}
                    </>
                  ) : (
                    <span className="italic">No record from {PREV_YEAR}</span>
                  )}
                </div>
              </div>
            ))}
            {shown.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
                No courses in this view.
              </p>
            )}
          </div>
        </div>

        {loadOpen && (
          <FacultyLoadPanel onClose={() => setLoadOpen(false)} highlightFaculty={hovered} />
        )}
      </div>
      </div>
    </StepShell>
  )
}

// Inline chips + add-dropdown editor for a course's teaching faculty.
function FacultyEditor({ value, onChange }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((f) => (
        <span
          key={f}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {f}
          <button
            onClick={() => onChange(value.filter((x) => x !== f))}
            className="text-slate-400 hover:text-red-500"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {adding ? (
        <select
          autoFocus
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value])
            setAdding(false)
          }}
          onBlur={() => setAdding(false)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Type or select…</option>
          {allFaculty
            .filter((f) => !value.includes(f))
            .map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
        </select>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500 transition hover:border-accent hover:text-accent dark:border-slate-600"
        >
          <Plus size={13} /> {value.length ? 'Add' : 'Select faculty'}
        </button>
      )}
    </div>
  )
}
