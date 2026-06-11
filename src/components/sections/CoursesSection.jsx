import { useMemo, useState } from 'react'
import { Check, Plus, Minus, ChevronDown, Sparkles } from 'lucide-react'
import { useApp } from '../../store/AppContext.jsx'
import { TERM, PREV_YEAR } from '../../data/seed.js'
import {
  PROGRAMS,
  DISCIPLINE_LABEL,
  matchesFilter,
  courseProgram,
  courseDisciplineCode,
} from '../../logic/timetable.js'
import CourseFilters from '../CourseFilters.jsx'
import AddCourseModal from '../AddCourseModal.jsx'
import SectionHeader from './SectionHeader.jsx'

const programLabel = (cohort) =>
  PROGRAMS.find((p) => p.id === courseProgram(cohort))?.label || cohort
const DISCIPLINES = Object.values(DISCIPLINE_LABEL)

// Step 1 — the running-courses list, as editable cards. Each course is carried
// over from last year; the coordinator confirms/edits programme + discipline,
// removes courses that aren't running, or adds new ones, then marks the section
// done (which unlocks allotment).
export default function CoursesSection() {
  const { courses, workflow, finaliseCourses, removeCourse, addCourse } = useApp()
  const [filter, setFilter] = useState({ program: '', sub: '', query: '' })
  const [adding, setAdding] = useState(false) // "Add a new course" modal
  const [disc, setDisc] = useState({}) // local discipline overrides, by course id
  // For the running-courses list, "allotted" = fully set up (faculty + slots + venue).
  const isAllotted = (c) => c.faculty.length > 0 && c.slots.length > 0 && !!c.venue

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

  const discOf = (c) =>
    disc[c.id] ?? (courseDisciplineCode(c.cohort) ? DISCIPLINE_LABEL[courseDisciplineCode(c.cohort)] : '')

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader
        eyebrow={`Department Timetable ${TERM.semester} 2026-27`}
        title="Running Courses List"
        action={
          <button
            onClick={finaliseCourses}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              workflow.coursesFinalised
                ? 'bg-ok-soft text-green-800'
                : 'bg-accent text-white hover:brightness-95'
            }`}
          >
            {workflow.coursesFinalised && <Check size={16} strokeWidth={3} />}
            {workflow.coursesFinalised ? 'Marked as done' : "Mark this section as 'Done'"}
          </button>
        }
      />

      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Courses are carried over from Academic Year {PREV_YEAR}, {TERM.semester} Semester. Make edits
        to this list as required.
      </p>

      {!workflow.coursesFinalised && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3 text-sm text-slate-700 dark:border-accent/20 dark:bg-slate-800/60 dark:text-slate-200">
          <Sparkles size={15} className="text-accent" />
          Confirm the running courses to unlock faculty, slot and venue allotment.
        </div>
      )}

      {/* Filter + add */}
      <div className="mt-5 flex items-center gap-4">
        <CourseFilters value={filter} onChange={setFilter} searchPlaceholder="Search a course code or name" />
        <button
          onClick={() => setAdding(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-200"
        >
          <Plus size={15} /> Add a new course
        </button>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <span className="text-xs text-slate-400">
          <b className="text-slate-600 dark:text-slate-300">{allottedCount}</b> of {list.length} fully
          allotted
        </span>
      </div>

      {/* Cards */}
      <div className="mt-3 space-y-3 pb-4">
        {list.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {c.type} Course · {c.credits} Credits
              </div>
              <div className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">
                <span className="text-slate-500 dark:text-slate-400">{c.code}</span>
                <span className="mx-1.5 text-slate-300">|</span>
                {c.title}
              </div>
            </div>

            <Labelled label="Programme">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {programLabel(c.cohort)}
              </span>
            </Labelled>

            <Labelled label="Discipline">
              <div className="relative">
                <select
                  value={discOf(c)}
                  onChange={(e) => setDisc((d) => ({ ...d, [c.id]: e.target.value }))}
                  className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="">Select discipline</option>
                  {DISCIPLINES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </Labelled>

            <button
              onClick={() => removeCourse(c.id)}
              title="Remove course"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-slate-700"
            >
              <Minus size={16} />
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
            No courses in this view.
          </p>
        )}
      </div>

      {adding && <AddCourseModal onClose={() => setAdding(false)} onAdd={addCourse} />}
    </div>
  )
}

// A small stacked "label over value" cell used on the cards.
function Labelled({ label, children }) {
  return (
    <div className="shrink-0">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  )
}
