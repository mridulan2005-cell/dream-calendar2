import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Lock, X, RadioTower } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, slotDateRange, TERM, cohorts } from '../data/seed.js'
import { isProtected } from '../data/rules.js'

const slotOrder = (id) => allSlots.findIndex((s) => s.id === id)

// A grey course block, styled like the main timetable cells (code / batch /
// faculty). The course currently being allotted carries a slight yellow border.
function CourseBlock({ course, isActive, onRemove }) {
  const cls = `w-full rounded-md bg-slate-100 px-2 py-1.5 text-left dark:bg-slate-800 ${
    isActive ? 'border-2 border-amber-400 dark:border-amber-400' : 'border-2 border-transparent'
  }`
  const body = (
    <>
      <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{course.code}</div>
      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">{course.cohort}</div>
      {course.faculty?.length > 0 && (
        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
          {course.faculty.join(', ')}
        </div>
      )}
    </>
  )
  if (onRemove) {
    return (
      <button onClick={onRemove} title={`Remove ${course.code} from this week`} className={`group ${cls} transition hover:bg-slate-200 dark:hover:bg-slate-700`}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

// Direct-manipulation week grid. Opens in its OWN browser tab (launched from a
// slot-allotment card) and stays lock-step with the planner via the store's
// BroadcastChannel — including which course is selected, so switching the course
// in the planner switches the one you allot here. Rows are the teaching weeks
// (W1…W15); columns are batches (default: the course's batch, "Add batch" to
// bring in more for reference). A week holds only ONE course per batch.
export default function SlotGridEditor() {
  const [params] = useSearchParams()
  const cohort = params.get('cohort') || ''
  const focusId = params.get('focus') || ''
  const { courses, updateCourse, selectedCourseId, setSelectedCourse } = useApp()

  // The active course follows the planner's selection, falling back to the URL.
  const activeId = selectedCourseId || focusId
  const focus = courses.find((c) => c.id === activeId) || null
  const cap = focus ? focus.durationWeeks || focus.slots.length || 1 : 0
  const chosen = focus ? focus.slots.length : 0

  // Align the shared selection to this grid's course on first open.
  useEffect(() => {
    if (!selectedCourseId && focusId) setSelectedCourse(focusId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [cols, setCols] = useState(() => (cohort ? [cohort] : []))
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef(null)
  useEffect(() => {
    const onDoc = (e) => {
      if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Make sure the active course's batch is always a visible column.
  useEffect(() => {
    if (focus && !cols.includes(focus.cohort)) setCols((p) => [...p, focus.cohort])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.cohort])

  const addable = cohorts.filter((c) => !cols.includes(c))

  // The single course occupying a week in a batch (one course per week).
  const occupantIn = (col, slotId) =>
    courses.find((c) => c.cohort === col && c.slots.includes(slotId))

  const toggleWeek = (slotId) => {
    if (!focus || isProtected(slotId)) return
    if (focus.slots.includes(slotId)) {
      updateCourse({ ...focus, slots: focus.slots.filter((s) => s !== slotId) })
      return
    }
    if (focus.slots.length >= cap) return
    const occ = occupantIn(focus.cohort, slotId)
    if (occ && occ.id !== focus.id) return // week already taken in this batch
    const next = [...focus.slots, slotId].sort((a, b) => slotOrder(a) - slotOrder(b))
    updateCourse({ ...focus, slots: next })
  }

  if (!focus) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p className="px-6 py-16 text-center text-sm text-slate-400">
          Select a course in the Slot Allotment step to allot its weeks here.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Allotting weeks · {TERM.semester} 2026-27
          </div>
          <h1 className="text-xl font-bold">
            <span className="text-slate-500 dark:text-slate-400">{focus.code}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            {focus.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              chosen === cap
                ? 'bg-ok-soft text-green-700 dark:text-green-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            {chosen} of {cap} week{cap > 1 ? 's' : ''} chosen
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent dark:bg-slate-800">
            <RadioTower size={13} /> Live-synced with planner
          </span>
        </div>
      </header>

      <div className="overflow-auto p-6">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-28 rounded-tl-lg border-b border-l border-t border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                Week
              </th>
              {cols.map((col) => {
                const isFocus = col === focus.cohort
                return (
                  <th
                    key={col}
                    className={`min-w-[150px] border-b border-r border-t border-slate-200 px-3 py-2.5 text-left align-middle font-semibold dark:border-slate-700 ${
                      isFocus
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                        : 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{col}</span>
                      {cols.length > 1 && (
                        <button
                          onClick={() => setCols((p) => p.filter((c) => c !== col))}
                          title={`Remove ${col} column`}
                          className="shrink-0 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    {isFocus && (
                      <div className="mt-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                        allotting {focus.code}
                      </div>
                    )}
                  </th>
                )
              })}
              {/* Add-batch control */}
              <th className="sticky top-0 border-b border-t border-slate-200 bg-white px-3 py-2.5 align-middle dark:border-slate-700 dark:bg-slate-950">
                <div className="relative" ref={addRef}>
                  <button
                    onClick={() => setAddOpen((o) => !o)}
                    disabled={addable.length === 0}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-400"
                  >
                    <Plus size={14} /> Add batch
                  </button>
                  {addOpen && addable.length > 0 && (
                    <div className="absolute right-0 top-full z-40 mt-1.5 max-h-72 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      <button
                        onClick={() => {
                          setCols(cohorts.slice())
                          setAddOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-semibold text-accent transition hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Plus size={13} /> All batches
                      </button>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                      {addable.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setCols((p) => [...p, c])
                            setAddOpen(false)
                          }}
                          className="flex w-full items-center px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {allSlots.map((s) => {
              const protectedWk = isProtected(s.id)
              return (
                <tr key={s.id}>
                  <td
                    className={`sticky left-0 z-10 w-28 border-b border-l border-slate-200 px-3 py-2 align-top dark:border-slate-800 ${
                      protectedWk ? 'bg-slate-100 dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                      {s.label}
                      {protectedWk && <Lock size={11} className="text-slate-400" />}
                    </div>
                    <div className="whitespace-nowrap text-[9px] font-normal text-slate-400">
                      {slotDateRange(s.id)}
                    </div>
                  </td>

                  {cols.map((col) => {
                    const isFocusBatch = col === focus.cohort
                    const occ = occupantIn(col, s.id)
                    const canAdd =
                      isFocusBatch && !occ && !protectedWk && focus.slots.length < cap
                    return (
                      <td
                        key={col}
                        className={`h-14 border-b border-r border-slate-200 p-1 align-middle dark:border-slate-800 ${
                          protectedWk
                            ? 'bg-slate-50/70 dark:bg-slate-900/40'
                            : isFocusBatch
                              ? 'bg-amber-50/30 dark:bg-amber-950/10'
                              : 'bg-white dark:bg-slate-950'
                        }`}
                      >
                        {protectedWk ? (
                          <div className="flex h-full items-center justify-center text-slate-300 dark:text-slate-600">
                            <Lock size={13} />
                          </div>
                        ) : occ ? (
                          <CourseBlock
                            course={occ}
                            isActive={occ.id === activeId}
                            onRemove={occ.id === activeId ? () => toggleWeek(s.id) : null}
                          />
                        ) : canAdd ? (
                          <button
                            onClick={() => toggleWeek(s.id)}
                            title={`Allot ${focus.code} to ${s.label}`}
                            className="group flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-200 transition hover:border-amber-400 hover:bg-amber-50 dark:border-slate-700 dark:hover:bg-amber-950/20"
                          >
                            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                              <Plus size={12} /> {focus.code}
                            </span>
                          </button>
                        ) : null}
                      </td>
                    )
                  })}
                  <td className="border-b border-slate-100 dark:border-slate-800/50" />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
