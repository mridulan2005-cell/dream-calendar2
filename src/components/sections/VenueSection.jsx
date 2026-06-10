import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { useApp } from '../../store/AppContext.jsx'
import { TERM, PREV_YEAR, venues as allVenues } from '../../data/seed.js'
import { matchesFilter, progress } from '../../logic/timetable.js'
import CourseFilters from '../CourseFilters.jsx'
import SectionHeader from './SectionHeader.jsx'
import MarkDoneButton from './MarkDoneButton.jsx'
import StatusFilter from './StatusFilter.jsx'

// Step 4 — venue allotment, as cards consistent with the faculty/slot lists. The
// right of each card shows the room the course used last year as a reference.
export default function VenueSection() {
  const { courses, updateCourse, workflow, setStepDone, selectedCourseId, setSelectedCourse } = useApp()
  const [filter, setFilter] = useState({ program: '', sub: '', query: '' })
  const [status, setStatus] = useState('all') // all | allotted | unallotted
  const isAllotted = (c) => !!c.venue

  // Bring the course selected elsewhere (e.g. clicked in the grid editor) into
  // view here, so picking a course in the grid surfaces it for venue allotment.
  const selectedRef = useRef(null)
  useEffect(() => {
    if (selectedCourseId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedCourseId])

  const stat = progress(courses).venue
  const complete = stat.done === stat.total
  const stepDone = workflow.venueFinalised
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

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow={`Department Timetable ${TERM.semester} 2026-27`}
        title="Venue Allotment"
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
              onToggle={() => setStepDone('venue', !stepDone)}
            />
          </div>
        }
      />

      <div className="mt-5">
        <CourseFilters value={filter} onChange={setFilter} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <StatusFilter value={status} onChange={setStatus} counts={counts} />
        <span className="text-xs text-slate-400">
          <b className="text-slate-600 dark:text-slate-300">{allottedCount}</b> of {list.length} venues
          allotted
        </span>
      </div>

      <div className="mt-3 space-y-3 pb-4">
        {shown.map((c) => {
          const isSelected = selectedCourseId === c.id
          return (
          <div
            key={c.id}
            ref={isSelected ? selectedRef : null}
            onClick={() => setSelectedCourse(c.id)}
            className={`flex cursor-pointer items-center gap-5 rounded-2xl border bg-white px-5 py-4 transition dark:bg-slate-900 ${
              isSelected
                ? 'border-amber-400 ring-2 ring-amber-300 dark:border-amber-500 dark:ring-amber-700'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
            }`}
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
              <div className="mt-0.5 truncate text-xs text-slate-400">{c.cohort}</div>
            </div>

            <div className="flex-1">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Venue
              </div>
              <div className="relative inline-block">
                <select
                  value={c.venue || ''}
                  onChange={(e) => updateCourse({ ...c, venue: e.target.value })}
                  className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="">Select a venue</option>
                  {allVenues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            <div className="flex w-52 shrink-0 items-center justify-end gap-1.5 text-right text-xs text-slate-400">
              <MapPin size={13} className="shrink-0" />
              {c.prevVenue ? (
                <span>
                  Used <span className="font-medium text-slate-600 dark:text-slate-300">{c.prevVenue}</span> in{' '}
                  {PREV_YEAR}
                </span>
              ) : (
                <span className="italic">No record from {PREV_YEAR}</span>
              )}
            </div>
          </div>
          )
        })}
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
            No courses in this view.
          </p>
        )}
      </div>
    </div>
  )
}
