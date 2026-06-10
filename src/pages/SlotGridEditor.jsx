import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Lock, X, Ban, Layers, Check, MapPin } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, slotLabel, slotDateRange, TERM, cohorts } from '../data/seed.js'
import { isProtected, isExamWeek, examWeekLabel } from '../data/rules.js'

const slotOrder = (id) => allSlots.findIndex((s) => s.id === id)
const joinWeeks = (ids) => ids.map(slotLabel).join(', ')

// An accessible on/off switch (role=switch) — the iOS-style toggle pattern.
function Switch({ checked, onChange, labelId }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        checked ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// Confirmation shown when a course is dropped onto a week another course already
// holds for the same batch. The coordinator decides whether the two genuinely
// run in parallel (turning a clash into an intentional overlap); if so they can
// extend that across the rest of the existing course's run in one step.
function ParallelModal({ focus, slotId, existing, onConfirm, onCancel }) {
  const [parallel, setParallel] = useState(false)
  const [applyAll, setApplyAll] = useState(true)

  // Weeks the existing course(s) also run, beyond the one just dropped on —
  // candidates to extend the parallel pairing across. Co-running stretches the
  // course to match its partner, so this isn't bounded by its nominal duration.
  const primary = existing[0]
  const otherWeeks = primary.slots.filter((s) => s !== slotId && !isProtected(s))
  const canApplyAll = otherWeeks.length > 0
  const names = existing.map((c) => c.code).join(', ')

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parallel-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <Layers size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="parallel-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {slotLabel(slotId)} already has a course
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <b className="text-slate-700 dark:text-slate-200">{names}</b>{' '}
              {existing.length > 1 ? 'already run' : 'already runs'} in {slotLabel(slotId)} for{' '}
              {focus.cohort}
              {otherWeeks.length > 0 && <> (across {joinWeeks(primary.slots)})</>}.
            </p>
          </div>
        </div>

        <div className="mt-5 px-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="min-w-0">
              <div id="parallel-q" className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Does {focus.code} run in parallel?
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Turn on only if both meet at the same time. Otherwise they can't share this week.
              </p>
            </div>
            <Switch checked={parallel} onChange={setParallel} labelId="parallel-q" />
          </div>

          {/* Extend-across-weeks option — revealed once parallel is confirmed. */}
          <div
            className={`grid transition-all duration-300 ease-out ${
              parallel && canApplyAll ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    applyAll
                      ? 'border-accent bg-accent text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {applyAll && <Check size={12} />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={applyAll}
                  onChange={(e) => setApplyAll(e.target.checked)}
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  Also place {focus.code} across {primary.code}'s other weeks
                  <span className="text-slate-400"> ({joinWeeks(otherWeeks)})</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ applyAll: applyAll && canApplyAll })}
            disabled={!parallel}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run in parallel
          </button>
        </div>
      </div>
    </div>
  )
}

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
function CourseBlock({ course, isActive, onClick, title, merge = {}, showLabel = true }) {
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
  // The cell sits under its batch column, so the block shows what isn't already
  // obvious: the course code, who teaches it, and — once allotted — the venue.
  const body = showLabel ? (
    <>
      <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{course.code}</div>
      {course.faculty?.length > 0 && (
        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
          {course.faculty.join(', ')}
        </div>
      )}
      {course.venue && (
        <div className="flex items-center gap-0.5 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
          <MapPin size={9} className="shrink-0" />
          {course.venue}
        </div>
      )}
    </>
  ) : null
  if (onClick) {
    return (
      <button onClick={onClick} title={title} className={`group ${cls} hover:bg-slate-200 dark:hover:bg-slate-700`}>
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
  const { courses, updateCourse, updateCourses, selectedCourseId, setSelectedCourse, activeStep } = useApp()
  // A pending parallel-placement awaiting confirmation: { slotId, existing }.
  const [pending, setPending] = useState(null)
  // Weeks are editable only while the planner list is on the Slot step. On other
  // steps (e.g. Venue) the grid is read-only and a click just selects the course.
  const inSlotStep = activeStep === 'slot'

  // The active course follows the planner's selection, falling back to the URL.
  const activeId = selectedCourseId || focusId
  const focus = courses.find((c) => c.id === activeId) || null
  const cap = focus ? focus.durationWeeks || focus.slots.length || 1 : 0
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

  // Every course occupying a week in a batch. Usually one, but courses marked as
  // running in parallel share the same week-cell.
  const occupantsIn = (col, slotId) =>
    courses.filter((c) => c.cohort === col && c.slots.includes(slotId))

  // Remove the active course from a week, and drop any parallel pairing it no
  // longer overlaps with (keeps the relationship honest as weeks change).
  const removeWeek = (slotId) => {
    const nextSlots = focus.slots.filter((s) => s !== slotId)
    const partners = (focus.parallel || []).map((id) => courses.find((c) => c.id === id)).filter(Boolean)
    const stillParallel = partners.filter((p) => p.slots.some((sl) => nextSlots.includes(sl)))
    const dropped = partners.filter((p) => !stillParallel.includes(p))
    updateCourses([
      { ...focus, slots: nextSlots, parallel: stillParallel.map((p) => p.id) },
      ...dropped.map((p) => ({ ...p, parallel: (p.parallel || []).filter((id) => id !== focus.id) })),
    ])
  }

  // Add the active course to a week. If another course already holds the week
  // for this batch, defer to the parallel-confirmation modal.
  const addWeek = (slotId) => {
    const others = occupantsIn(focus.cohort, slotId).filter((c) => c.id !== focus.id)
    if (others.length) {
      setPending({ slotId, existing: others })
      return
    }
    const next = [...focus.slots, slotId].sort((a, b) => slotOrder(a) - slotOrder(b))
    // Placing on the grid commits the course to System M.
    updateCourse({ ...focus, slots: next, slotSystem: 'M' })
  }

  const toggleWeek = (slotId) => {
    if (!focus || isProtected(slotId) || !focusIsM) return
    if (focus.slots.includes(slotId)) removeWeek(slotId)
    else if (focus.slots.length < cap) addWeek(slotId)
  }

  // How a course block behaves when clicked: on the Slot step the active course's
  // block toggles the week off; on every other step a click just selects the
  // course so the planner list (e.g. Venue) can surface it.
  const blockInteraction = (c, slotId) => {
    if (inSlotStep) {
      return c.id === activeId
        ? { onClick: () => toggleWeek(slotId), title: `Remove ${c.code} from ${slotLabel(slotId)}` }
        : {}
    }
    return { onClick: () => setSelectedCourse(c.id), title: `Select ${c.code}` }
  }

  // Commit the pending parallel placement: drop the active course into the week
  // (and optionally the rest of the existing course's run), and record the
  // parallel pairing on both sides so it reads as intentional, not a clash.
  const confirmParallel = ({ applyAll }) => {
    const { slotId, existing } = pending
    const extra = applyAll
      ? existing[0].slots.filter((s) => s !== slotId && !isProtected(s) && !focus.slots.includes(s))
      : []
    const nextSlots = [...new Set([...focus.slots, slotId, ...extra])].sort(
      (a, b) => slotOrder(a) - slotOrder(b),
    )
    const partnerIds = existing.map((c) => c.id)
    updateCourses([
      {
        ...focus,
        slots: nextSlots,
        // Running parallel across a partner's full span can stretch the course
        // past its nominal duration — keep the cap in step so "x of n" holds.
        durationWeeks: Math.max(focus.durationWeeks || 1, nextSlots.length),
        slotSystem: 'M',
        parallel: [...new Set([...(focus.parallel || []), ...partnerIds])],
      },
      ...existing.map((c) => ({
        ...c,
        parallel: [...new Set([...(c.parallel || []), focus.id])],
      })),
    ])
    setPending(null)
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

  // Occupant grid (row = week, col = batch). Each cell is the list of courses in
  // that week; protected weeks are holes, so a course never merges across one.
  const grid = allSlots.map((s) =>
    isProtected(s.id) ? cols.map(() => []) : cols.map((col) => occupantsIn(col, s.id)),
  )
  // Only a lone occupant participates in block-fusing; parallel cells stay split.
  const soloAt = (ri, ci) => {
    const cell = grid[ri]?.[ci]
    return cell && cell.length === 1 ? cell[0] : null
  }
  const sameSpan = (a, b) =>
    a.slots.length === b.slots.length && a.slots.every((x) => b.slots.includes(x))
  const sameFaculty = (a, b) =>
    a.faculty.length === b.faculty.length && a.faculty.every((f) => b.faculty.includes(f))
  // Vertical: the very same course filling adjacent weeks. Horizontal: two
  // adjacent batches running what is effectively the same session — same code,
  // title and faculty over the same weeks — so it reads as one shared block
  // (whether it's a core for one batch or an elective for another).
  const fuses = (a, b, vertical) => {
    if (!a || !b) return false
    if (vertical) return a.id === b.id
    return (
      a.id !== b.id &&
      a.code === b.code &&
      a.title === b.title &&
      sameFaculty(a, b) &&
      sameSpan(a, b)
    )
  }
  const mergeAt = (ri, ci) => {
    const occ = soloAt(ri, ci)
    if (!occ) return null
    return {
      top: fuses(occ, soloAt(ri - 1, ci), true),
      bottom: fuses(occ, soloAt(ri + 1, ci), true),
      left: fuses(occ, soloAt(ri, ci - 1), false),
      right: fuses(occ, soloAt(ri, ci + 1), false),
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

      {focusIsM && !inSlotStep && (
        <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Lock size={15} className="shrink-0 text-slate-400" />
          <span>
            {activeStep === 'venue'
              ? 'Venue allotment is active — weeks are locked here. Click a course to surface it in the planner and assign its room.'
              : 'Weeks can only be edited on the Slot step of the planner. Click a course to select it.'}
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
                    <div className="absolute right-0 bottom-full z-50 mb-1.5 max-h-72 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
              const examWk = isExamWeek(s.id)
              return (
                <tr key={s.id}>
                  <td
                    className={`sticky left-0 z-10 w-28 border-b border-l px-3 py-2 align-top ${
                      examWk
                        ? 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                      {s.label}
                    </div>
                    <div className="whitespace-nowrap text-[9px] font-normal text-slate-400">
                      {slotDateRange(s.id)}
                    </div>
                    {examWk && (
                      <div className="mt-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                        {examWeekLabel(s.id)}
                      </div>
                    )}
                  </td>

                  {cols.map((col, ci) => {
                    const isFocusBatch = col === focus.cohort
                    const cell = grid[ri][ci] // courses in this week-cell
                    const hasFocusHere = cell.some((c) => c.id === focus.id)
                    const hasRoom = focus.slots.length < cap
                    const canAdd =
                      inSlotStep && isFocusBatch && focusIsM && cell.length === 0 && hasRoom
                    // Dropping onto a cell another course already holds offers a
                    // parallel pairing (instead of a hard block).
                    const canParallel =
                      inSlotStep && isFocusBatch && focusIsM && hasRoom && !hasFocusHere && cell.length > 0
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
                        className={`relative h-14 border-b border-r ${seamB} ${seamR} ${pad} align-middle transition-all duration-300 ease-out ${
                          // Exam weeks tint the whole row across every batch, but
                          // stay placeable; the focus batch keeps its amber wash.
                          examWk
                            ? 'bg-rose-50/70 dark:bg-rose-950/20'
                            : isFocusBatch
                              ? 'bg-amber-50/30 dark:bg-amber-950/10'
                              : 'bg-white dark:bg-slate-950'
                        }`}
                      >
                        {cell.length > 1 ? (
                          // Parallel cell: the courses share the week (different
                          // students in each), shown as one block split into rows.
                          <div
                            className="flex w-full flex-col divide-y divide-slate-300 overflow-hidden rounded-md dark:divide-slate-600"
                            title="These courses run in parallel — different students in each"
                          >
                            {cell.map((c) => {
                              const act = c.id === activeId
                              const inter = blockInteraction(c, s.id)
                              const rowCls = `flex flex-col justify-center px-2 py-1 text-left transition ${
                                act
                                  ? 'bg-amber-100 dark:bg-amber-950/50'
                                  : 'bg-slate-100 dark:bg-slate-800'
                              } ${inter.onClick ? 'hover:bg-slate-200 dark:hover:bg-slate-700' : ''}`
                              const rowBody = (
                                <>
                                  <div className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                                    {c.code}
                                  </div>
                                  {c.faculty?.length > 0 && (
                                    <div className="truncate text-[9px] text-slate-500 dark:text-slate-400">
                                      {c.faculty.join(', ')}
                                    </div>
                                  )}
                                  {c.venue && (
                                    <div className="flex items-center gap-0.5 truncate text-[9px] text-slate-500 dark:text-slate-400">
                                      <MapPin size={8} className="shrink-0" />
                                      {c.venue}
                                    </div>
                                  )}
                                </>
                              )
                              return inter.onClick ? (
                                <button key={c.id} onClick={inter.onClick} title={inter.title} className={rowCls}>
                                  {rowBody}
                                </button>
                              ) : (
                                <div key={c.id} className={rowCls}>
                                  {rowBody}
                                </div>
                              )
                            })}
                          </div>
                        ) : cell.length === 1 ? (
                          <CourseBlock
                            course={cell[0]}
                            isActive={cell[0].id === activeId}
                            {...blockInteraction(cell[0], s.id)}
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

                        {/* Hover affordance to run the active course parallel to
                            whatever already sits in this week. */}
                        {canParallel && (
                          <button
                            onClick={() => setPending({ slotId: s.id, existing: cell })}
                            title={`Run ${focus.code} in parallel here`}
                            className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 transition hover:bg-amber-50/70 hover:opacity-100 dark:hover:bg-amber-950/40"
                          >
                            <span className="flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shadow-sm dark:bg-slate-900/90 dark:text-amber-300">
                              <Plus size={10} /> parallel
                            </span>
                          </button>
                        )}
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

      {pending && (
        <ParallelModal
          focus={focus}
          slotId={pending.slotId}
          existing={pending.existing}
          onConfirm={confirmParallel}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
