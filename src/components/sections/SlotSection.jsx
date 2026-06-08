import { useMemo, useState } from 'react'
import { Info, ChevronDown, CircleAlert } from 'lucide-react'
import { useApp } from '../../store/AppContext.jsx'
import { TERM, PREV_YEAR, slotLabel, slotSystems, facultyPreferences } from '../../data/seed.js'
import { matchesFilter, progress, pastSlotSystem } from '../../logic/timetable.js'
import CourseFilters from '../CourseFilters.jsx'
import SlotSystemPanel from '../SlotSystemPanel.jsx'
import SlotPicker from '../SlotPicker.jsx'
import SectionHeader from './SectionHeader.jsx'
import MarkDoneButton from './MarkDoneButton.jsx'
import StatusFilter from './StatusFilter.jsx'

// Step 3 — slot allotment. Each course card carries the two signals the planner
// slots against: the slot SYSTEM it ran in last year, and any availability
// preferences its faculty have submitted (blocked weeks). A slotting-type
// selector records the chosen system (hover an option for its timing); the
// "View slotting types" panel opens alongside to explain each system in full.
export default function SlotSection() {
  const { courses, workflow, setStepDone } = useApp()
  const [filter, setFilter] = useState({ program: '', sub: '', query: '' })
  const [status, setStatus] = useState('all') // all | allotted | unallotted
  const [guideOpen, setGuideOpen] = useState(false)
  const [choice, setChoice] = useState({}) // course id -> chosen slotting system
  const isAllotted = (c) => c.slots.length > 0

  const stat = progress(courses).slot
  const complete = stat.done === stat.total
  const stepDone = workflow.slotFinalised
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
    <div className="mx-auto max-w-7xl">
      <SectionHeader
        eyebrow={`Department Timetable ${TERM.semester} 2026-27`}
        title="Slot Allotment"
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
              onToggle={() => setStepDone('slot', !stepDone)}
            />
          </div>
        }
      />

      {/* Slotting-types helper */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="text-slate-500 dark:text-slate-400">
          Not sure about the different slot systems? Explore how each one runs.
        </span>
        <button
          onClick={() => setGuideOpen((o) => !o)}
          className={`ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition ${
            guideOpen
              ? 'border-accent bg-accent-soft text-accent dark:bg-slate-800'
              : 'border-slate-200 bg-white text-slate-700 hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
          }`}
        >
          <Info size={15} /> View slotting types
        </button>
      </div>

      <div className="mt-5 flex items-start gap-6">
        {/* Left: filters + course cards */}
        <div className="min-w-0 flex-1">
          <CourseFilters value={filter} onChange={setFilter} />
          <div className="mt-4 flex items-center justify-between">
            <StatusFilter value={status} onChange={setStatus} counts={counts} />
            <span className="text-xs text-slate-400">
              <b className="text-slate-600 dark:text-slate-300">{allottedCount}</b> of {list.length}{' '}
              slots allotted
            </span>
          </div>

          <div className="mt-3 space-y-3 pb-4">
            {shown.map((c) => {
              const sys = choice[c.id] || '' // default: no system chosen yet
              const prefs = c.faculty
                .map((f) => (facultyPreferences[f] ? { faculty: f, ...facultyPreferences[f] } : null))
                .filter(Boolean)
              const pastSlots = c.slots.length ? c.slots.map(slotLabel).join(', ') : '—'
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-5">
                    <div className="min-w-0 flex-[1.4]">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {c.type} Course · {c.credits} Credits
                      </div>
                      <div className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">
                        <span className="text-slate-500 dark:text-slate-400">{c.code}</span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        {c.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">
                        To be taught by: {c.faculty.length ? c.faculty.join(' & ') : 'unassigned'}
                      </div>
                    </div>

                    {/* Slotting type + the slots it offers */}
                    <div className="flex flex-[2] items-start gap-3">
                      <div>
                        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Slotting type
                        </div>
                        <div className="relative inline-block">
                          <select
                            value={sys}
                            onChange={(e) => setChoice((s) => ({ ...s, [c.id]: e.target.value }))}
                            className={`appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm dark:border-slate-700 dark:bg-slate-900 ${
                              sys ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'
                            }`}
                          >
                            <option value="">Select slot system</option>
                            {slotSystems.map((s) => (
                              <option key={s.id} value={s.id} title={s.timing}>
                                Slot System {s.id}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={15}
                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Slots picker — appears once a system is chosen */}
                      {sys && <SlotPicker course={c} system={slotSystems.find((s) => s.id === sys)} />}
                    </div>

                    {/* Last-year reference */}
                    <div className="w-48 shrink-0 text-right text-xs leading-snug text-slate-400">
                      Ran in{' '}
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        Slot System {pastSlotSystem(c)}
                      </span>{' '}
                      (Slots {pastSlots}) in {PREV_YEAR}
                    </div>
                  </div>

                  {/* Faculty availability preferences */}
                  {prefs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {prefs.map((p) => (
                        <span
                          key={p.faculty}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                        >
                          <CircleAlert size={12} />
                          {p.faculty}: {p.note}
                        </span>
                      ))}
                    </div>
                  )}
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

        {/* Right: slotting-types reference panel */}
        {guideOpen && <SlotSystemPanel onClose={() => setGuideOpen(false)} />}
      </div>
    </div>
  )
}
