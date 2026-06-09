import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Lock, X, RadioTower, Ban } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, slotDateRange, TERM, cohorts } from '../data/seed.js'
import { isProtected } from '../data/rules.js'

const slotOrder = (id) => allSlots.findIndex((s) => s.id === id)

// A grey course block, styled like the main timetable cells (code / batch /
// faculty). The course currently being allotted carries a slight yellow border.
//
// `merge` tells the block which of its four edges touch a sibling cell that
// belongs to the SAME visual block (same course down consecutive weeks, or the
// same course across adjacent batches of identical duration). On those edges we
// straighten the corners and drop the seam so the cells read as one continuous
// block; everywhere else we keep the rounded, free-standing look. The
// straightening is transitioned, so blocks fuse/split with a smooth
// microinteraction as weeks are toggled. Only the block's top-left origin cell
// carries the label — continuation cells render as bare fill.
function CourseBlock({ course, isActive, onRemove, merge = {}, showLabel = true }) {
  const radius = [
    !merge.top && !merge.left ? 'rounded-tl-md' : '',
    !merge.top && !merge.right ? 'rounded-tr-md' : '',
    !merge.bottom && !merge.left ? 'rounded-bl-md' : '',
    !merge.bottom && !merge.right ? 'rounded-br-md' : '',
  ].join(' ')
  // Active outline hugs the block's outer boundary. Vertical seams (same course,
  // same active state) open up; horizontal seams stay closed since the neighbour
  // is a different, un-highlighted batch.
  const border = isActive
    ? `border-l-amber-400 border-r-amber-400 ${merge.top ? 'border-t-transparent' : 'border-t-amber-400'} ${
        merge.bottom ? 'border-b-transparent' : 'border-b-amber-400'
      } dark:border-amber-400`
    : 'border-transparent'
  const cls = `flex h-full w-full flex-col justify-center border-2 bg-slate-100 px-2 py-1.5 text-left transition-all duration-300 ease-out dark:bg-slate-800 ${radius} ${border}`
  const body = showLabel ? (
    <>
      <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{course.code}</div>
      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">{course.cohort}</div>
      {course.faculty?.length > 0 && (
        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
          {course.faculty.join(', ')}
        </div>
      )}
    </>
  ) : null
  if (onRemove) {
    return (
      <button onClick={onRemove} title={`Remove ${course.code} from this week`} className={`group ${cls} hover:bg-slate-200 dark:hover:bg-slate-700`}>
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
  // The grid is System M only. A course slotted under any other system can't be
  // placed here; a course with no system yet becomes M as soon as it's placed.
  const focusIsM = focus ? !focus.slotSystem || focus.slotSystem === 'M' : false

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
    if (!focus || isProtected(slotId) || !focusIsM) return
    if (focus.slots.includes(slotId)) {
      updateCourse({ ...focus, slots: focus.slots.filter((s) => s !== slotId) })
      return
    }
    if (focus.slots.length >= cap) return
    const occ = occupantIn(focus.cohort, slotId)
    if (occ && occ.id !== focus.id) return // week already taken in this batch
    const next = [...focus.slots, slotId].sort((a, b) => slotOrder(a) - slotOrder(b))
    // Placing on the grid commits the course to System M.
    updateCourse({ ...focus, slots: next, slotSystem: 'M' })
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

  // Occupant grid (row = week, col = batch) used to decide where blocks fuse.
  // Protected weeks are holes, so a course never merges across one.
  const grid = allSlots.map((s) =>
    isProtected(s.id) ? cols.map(() => null) : cols.map((col) => occupantIn(col, s.id) || null),
  )
  const sameSpan = (a, b) =>
    a.slots.length === b.slots.length && a.slots.every((x) => b.slots.includes(x))
  // Vertical: the very same course filling adjacent weeks. Horizontal: a
  // different batch running the same course over the same set of weeks.
  const fuses = (a, b, vertical) => {
    if (!a || !b) return false
    return vertical ? a.id === b.id : a.id !== b.id && a.code === b.code && sameSpan(a, b)
  }
  const mergeAt = (ri, ci) => {
    const occ = grid[ri][ci]
    if (!occ) return null
    return {
      top: fuses(occ, grid[ri - 1]?.[ci], true),
      bottom: fuses(occ, grid[ri + 1]?.[ci], true),
      left: fuses(occ, grid[ri][ci - 1], false),
      right: fuses(occ, grid[ri][ci + 1], false),
    }
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

      {!focusIsM && (
        <div className="flex items-center gap-2.5 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Ban size={16} className="shrink-0" />
          <span>
            <b>{focus.code}</b> is slotted under Slot System {focus.slotSystem}, which isn't placed on
            the week grid. Switch it to System M in the planner to allot weeks here.
          </span>
        </div>
      )}

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
            {allSlots.map((s, ri) => {
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

                  {cols.map((col, ci) => {
                    const isFocusBatch = col === focus.cohort
                    const occ = occupantIn(col, s.id)
                    const canAdd =
                      isFocusBatch && focusIsM && !occ && !protectedWk && focus.slots.length < cap
                    const merge = mergeAt(ri, ci)
                    // Close the inter-cell gap (td padding) and hide the seam
                    // border on edges where this block fuses with a neighbour.
                    const pad = merge
                      ? `${merge.top ? 'pt-0' : 'pt-1'} ${merge.bottom ? 'pb-0' : 'pb-1'} ${
                          merge.left ? 'pl-0' : 'pl-1'
                        } ${merge.right ? 'pr-0' : 'pr-1'}`
                      : 'p-1'
                    const seamB =
                      merge?.bottom ? 'border-b-transparent' : 'border-b-slate-200 dark:border-b-slate-800'
                    const seamR =
                      merge?.right ? 'border-r-transparent' : 'border-r-slate-200 dark:border-r-slate-800'
                    return (
                      <td
                        key={col}
                        className={`h-14 border-b border-r ${seamB} ${seamR} ${pad} align-middle transition-all duration-300 ease-out ${
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
                            merge={merge}
                            showLabel={!(merge.top || merge.left)}
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
