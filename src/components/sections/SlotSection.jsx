import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, CircleAlert, Grid3x3, Search } from 'lucide-react'
import { useApp } from '../../store/AppContext.jsx'
import { TERM, PREV_YEAR, slotLabel, slotSystems, facultyPreferences } from '../../data/seed.js'
import { progress, pastSlotSystem } from '../../logic/timetable.js'
import SlotPicker from '../SlotPicker.jsx'
import BatchTabs from '../BatchTabs.jsx'
import SectionHeader from './SectionHeader.jsx'
import MarkDoneButton from './MarkDoneButton.jsx'
import StatusFilter from './StatusFilter.jsx'

// Step 3 — slot allotment. The list view is filtered by BATCH tag chips (BDes 1
// / BDes 2 / … / All) and a search box. Clicking a course card SELECTS it — the
// course you're allotting carries a yellow highlight. Each card carries the slot
// SYSTEM it ran in last year and any faculty availability preferences; a
// slotting-type selector reveals the week picker (and a "Grid" button that opens
// the batch's week grid in a state-synced tab).
export default function SlotSection() {
  const {
    courses,
    workflow,
    setStepDone,
    selectedCourseId,
    selectedCourseIds,
    setSelectedCourse,
    setSelectedCourses,
    updateCourse,
  } = useApp()
  const [filterBy, setFilterBy] = useState('batch') // 'batch' | 'faculty'
  const [cohortTags, setCohortTags] = useState([]) // empty = show all batches
  const [facultyTags, setFacultyTags] = useState([]) // empty = show all faculty
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all') // all | allotted | unallotted
  // Anchor for Shift-range selection. The selection itself lives in the store so
  // the grid window can read it and place every picked course into a week.
  const [lastClicked, setLastClicked] = useState(null)
  const isAllotted = (c) => c.slots.length > 0
  // Faculty who teach at least one course — the options for the "By faculty" chips.
  const facultyOptions = useMemo(
    () => [...new Set(courses.flatMap((c) => c.faculty))].sort(),
    [courses],
  )

  const stat = progress(courses).slot
  const complete = stat.done === stat.total
  const stepDone = workflow.slotFinalised
  const q = query.trim().toLowerCase()

  const list = useMemo(
    () =>
      courses.filter((c) => {
        const matchesChips =
          filterBy === 'batch'
            ? cohortTags.length === 0 || cohortTags.includes(c.cohort)
            : facultyTags.length === 0 || c.faculty.some((f) => facultyTags.includes(f))
        return (
          matchesChips &&
          (!q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
        )
      }),
    [courses, filterBy, cohortTags, facultyTags, q],
  )
  const allottedCount = list.filter(isAllotted).length
  const counts = { all: list.length, allotted: allottedCount, unallotted: list.length - allottedCount }
  const shown =
    status === 'all' ? list : list.filter((c) => (status === 'allotted' ? isAllotted(c) : !isAllotted(c)))

  // Jump to the selected course (e.g. picked in the grid window): scroll its card
  // into view, clearing filters first if they'd hide it.
  const selectedRef = useRef(null)
  useEffect(() => {
    if (!selectedCourseId) return
    if (!shown.some((c) => c.id === selectedCourseId)) {
      if (cohortTags.length) setCohortTags([])
      if (facultyTags.length) setFacultyTags([])
      if (status !== 'all') setStatus('all')
      return
    }
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, cohortTags, facultyTags, status, filterBy])

  // Card click: plain = single select, ⌘/Ctrl = toggle, Shift = range (over the
  // visible list). The selection syncs to the grid window, where clicking a week
  // places every picked course there (confirming the parallel run).
  const onCardClick = (c, e) => {
    e.stopPropagation() // don't let it bubble to the deselect handler
    if (e.shiftKey && lastClicked) {
      const ids = shown.map((x) => x.id)
      const i1 = ids.indexOf(lastClicked)
      const i2 = ids.indexOf(c.id)
      if (i1 !== -1 && i2 !== -1) {
        const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1]
        setSelectedCourses([...new Set([...selectedCourseIds, ...ids.slice(lo, hi + 1)])])
      }
      setLastClicked(c.id)
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedCourses(
        selectedCourseIds.includes(c.id)
          ? selectedCourseIds.filter((x) => x !== c.id)
          : [...selectedCourseIds, c.id],
      )
      setLastClicked(c.id)
    } else {
      setSelectedCourse(c.id)
      setLastClicked(c.id)
    }
  }

  return (
    <div
      className="mx-auto max-w-7xl"
      onClick={() => {
        // Click anywhere that isn't a course card → clear the selection.
        if (selectedCourseIds.length) setSelectedCourse(null)
        setLastClicked(null)
      }}
    >
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

      <div className="mt-5 flex items-start gap-6">
        {/* Left: filters + course cards */}
        <div className="min-w-0 flex-1">
          {/* Batch / faculty toggle + matching filter chips + search */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {[
                { id: 'batch', label: 'By batch' },
                { id: 'faculty', label: 'By faculty' },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setFilterBy(o.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    filterBy === o.id
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {filterBy === 'batch' ? (
              <BatchTabs value={cohortTags} onChange={setCohortTags} />
            ) : (
              <BatchTabs
                value={facultyTags}
                onChange={setFacultyTags}
                options={facultyOptions}
                allLabel="All faculty"
              />
            )}
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <Search size={15} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a course code or name"
                className="w-60 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <StatusFilter value={status} onChange={setStatus} counts={counts} />
            <span className="text-xs text-slate-400">
              <b className="text-slate-600 dark:text-slate-300">{allottedCount}</b> of {list.length}{' '}
              slots allotted
            </span>
          </div>

          {/* Multi-select hint — the picks carry over to the grid window. */}
          {selectedCourseIds.length >= 2 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2 text-xs text-slate-600 dark:border-accent/20 dark:bg-slate-800 dark:text-slate-300">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {selectedCourseIds.length} courses selected.
              </span>
              Open the grid and click a week to place them together — you'll confirm the parallel run
              there.
            </div>
          )}

          <div className="mt-3 space-y-3 pb-4">
            {shown.map((c) => {
              // The slotting system lives on the course so it syncs across tabs.
              // A course given weeks on the grid (M-slots) reads back as System M
              // even if it was never picked here — so grid edits reflect at once.
              const sys = c.slotSystem || (c.slots.length ? 'M' : '')
              const isM = sys === 'M'
              const prefs = c.faculty
                .map((f) => (facultyPreferences[f] ? { faculty: f, ...facultyPreferences[f] } : null))
                .filter(Boolean)
              const pastSlots = c.prevSlots?.length ? c.prevSlots.map(slotLabel).join(', ') : '—'
              const isSelected = selectedCourseIds.includes(c.id)
              return (
                <div
                  key={c.id}
                  ref={c.id === selectedCourseId ? selectedRef : null}
                  onClick={(e) => onCardClick(c, e)}
                  className={`cursor-pointer select-none rounded-2xl border bg-white px-5 py-4 transition dark:bg-slate-900 ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-300 dark:border-amber-500 dark:ring-amber-700'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                  }`}
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
                        {c.cohort} · To be taught by:{' '}
                        {c.faculty.length ? c.faculty.join(' & ') : 'unassigned'}
                      </div>
                    </div>

                    {/* Slotting type + the slots it offers. Interacting with these
                        controls shouldn't change the card multi-selection. */}
                    <div className="flex flex-[2] items-start gap-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Slotting type
                        </div>
                        <div className="relative inline-block">
                          <select
                            value={sys}
                            onChange={(e) => {
                              const v = e.target.value
                              // Switching away from System M clears any week-grid
                              // allotment — only M courses live on the grid.
                              updateCourse({
                                ...c,
                                slotSystem: v || null,
                                slots: v === 'M' ? c.slots : [],
                              })
                            }}
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

                      {/* Week picker + direct-manipulation grid — these are the
                          System M surfaces (full-week studio blocks). Only an M
                          course can be placed on the grid; other systems are
                          slotted through their own timetable, so the grid is
                          hidden for them. */}
                      {isM && (
                        <div className="flex items-end gap-2">
                          <SlotPicker course={c} />
                          <button
                            onClick={() =>
                              window.open(
                                `/slot-grid?cohort=${encodeURIComponent(c.cohort)}&focus=${encodeURIComponent(
                                  c.id,
                                )}&system=${sys}`,
                                '_blank',
                              )
                            }
                            title={`Open the ${c.cohort} week grid in a new tab — edits sync live`}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          >
                            <Grid3x3 size={14} /> Grid
                          </button>
                        </div>
                      )}
                      {sys && !isM && (
                        <div className="mt-5 max-w-[14rem] text-xs leading-snug text-slate-400">
                          Slot System {sys} is scheduled on its own timetable — not
                          on the week grid.
                        </div>
                      )}
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
      </div>
    </div>
  )
}
