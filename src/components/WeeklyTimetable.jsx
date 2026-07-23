import { useState, useMemo, useEffect } from 'react'
import { MapPin, ChevronDown, AlertTriangle, X, Layers, Check, Clock, Ban, Plus } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, cohorts } from '../data/seed.js'
import { DAYS, PERIODS, mSlotAt, freeSlotsAt, periodLabel } from '../data/slotSystem.js'
import { catalogueAt } from '../data/catalogue.js'
import { CellMenu, ReasonPopover } from './AvailabilityMenus.jsx'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtD = (iso) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MON[Number(m) - 1]}`
}

// Studio fill — one calm colour everywhere (batches are not colour-coded).
const STUDIO = 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/25'

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const periodsOverlap = (s1, e1, s2, e2) => toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2)

// A faculty-availability cell key `${day}#${periodId}` → "Mon 9:30–10:25".
const describeCell = (key) => {
  const [day, periodId] = key.split('#')
  const p = PERIODS.find((x) => x.id === periodId)
  return p ? `${day} ${periodLabel(p.start)}–${periodLabel(p.end)}` : day
}

// Look up a slot's clock time on a given day from the live institute system.
const slotTimeOnDay = (system, slotId, day) => {
  const all = [...(system?.S || []), ...(system?.L || [])]
  const hit = all.find((x) => x.id === slotId && x.day === day)
  return hit ? { start: hit.start, end: hit.end } : null
}

// The clock time a placed elective actually runs at on `day`: a custom (right-
// click) duration if the coordinator set one, otherwise the institute slot's own
// timing. Returns null when the elective doesn't meet that day.
const electiveTimeOnDay = (system, e, day) => {
  const runsToday = (e.weeklySlots || []).some((id) => slotTimeOnDay(system, id, day))
  if (!runsToday) return null
  if (e.customTime) return e.customTime
  const id = (e.weeklySlots || []).find((sid) => slotTimeOnDay(system, sid, day))
  return slotTimeOnDay(system, id, day)
}

// A sensible default to seed the duration editor with (first day it runs).
const electiveBaseTime = (system, e) => {
  if (e.customTime) return e.customTime
  for (const d of DAYS) {
    const t = electiveTimeOnDay(system, e, d)
    if (t) return t
  }
  return { start: '09:30', end: '10:55' }
}

// `match` selects which courses belong to the entity being shown — a cohort in
// batch view, or a faculty member in the faculty view. Accepts a predicate, or a
// cohort name for the legacy callers.
const computeBlocks = (courses, match) => {
  const matchFn = typeof match === 'function' ? match : (c) => c.cohort === match
  const occupantOf = (wid) => courses.find((c) => matchFn(c) && c.slots.includes(wid)) || null
  const out = []
  allSlots.forEach((w, i) => {
    const occ = occupantOf(w.id)
    if (!occ) return
    const last = out[out.length - 1]
    if (last && last.course.id === occ.id && last.endIdx === i - 1) {
      last.endIdx = i
      last.weeks.push(w)
    } else {
      out.push({ course: occ, startIdx: i, endIdx: i, weeks: [w] })
    }
  })
  return out
}

// Weekly view of the grid window, driven by the institute slot system. IDC runs
// in the M (studio) system, so the studio teaching a week fills its M cells and
// the free S / L institute slots show everywhere else. Two sub-views share the
// same layout (time periods across the top): Batch-specific (one batch, days
// down the side) and Day-specific (one day, the chosen batches down the side).
// In batch-specific view you can drag the batch's weekly DE electives onto the
// slot where they historically ran, or click to select and then click the slot.
export default function WeeklyTimetable({
  focus,
  courses,
  controlled = false,
  mode = 'student',
  selected = null,
  editable = true,
  // Faculty-availability wiring (only active on a faculty's own weekly view):
  selfKey = null,
  unavailability = {},
  onMarkUnavailable,
  onClearUnavailable,
  onRequestChange,
  discover = false,
  pickedCell = null,
  onPickCell,
}) {
  // The Master Timetable drives the weekly view from outside (a Student/Faculty
  // toggle + a batch/faculty dropdown live in its control bar), so there are no
  // day-specific sub-view or per-batch chips here — just the chosen entity's week.
  if (controlled) {
    return (
      <ControlledWeekly
        focus={focus}
        courses={courses}
        mode={mode}
        selected={selected}
        editable={editable}
        selfKey={selfKey}
        unavailability={unavailability}
        onMarkUnavailable={onMarkUnavailable}
        onClearUnavailable={onClearUnavailable}
        onRequestChange={onRequestChange}
        discover={discover}
        pickedCell={pickedCell}
        onPickCell={onPickCell}
      />
    )
  }
  return <LegacyWeekly focus={focus} courses={courses} />
}

// The original weekly view with its own Batch / Day sub-view selector and batch
// chips — still used by the Slot Grid Editor.
function LegacyWeekly({ focus, courses }) {
  const { updateCourse, slotSystem, weeklyElectives, updateWeeklyElective } = useApp()
  const [subView, setSubView] = useState('batch') // 'batch' | 'day'
  const [shown, setShown] = useState([focus.cohort])
  const [day, setDay] = useState('Mon')
  const [sel, setSel] = useState(0)
  // dragId  = weekly elective being dragged from the tray
  // activeElectiveId = clicked/selected in the tray (persists until cleared)
  const [dragId, setDragId] = useState(null)
  const [activeElectiveId, setActiveElectiveId] = useState(null)
  // Right-click duration editor: { id, x, y } anchored at the cursor.
  const [durationEdit, setDurationEdit] = useState(null)

  const switchView = (v) => {
    setSubView(v)
    setActiveElectiveId(null)
    if (v === 'batch') setShown((prev) => [prev[0] || focus.cohort])
  }
  const onChip = (b) => {
    if (subView === 'batch') setShown([b])
    else setShown((prev) => (prev.includes(b) ? (prev.length > 1 ? prev.filter((x) => x !== b) : prev) : [...prev, b]))
  }
  const allShown = shown.length === cohorts.length

  const leadBatch = shown[0] || focus.cohort
  const blocks = useMemo(() => computeBlocks(courses, leadBatch), [courses, leadBatch])
  useEffect(() => setSel(0), [leadBatch])
  const block = blocks[Math.min(sel, Math.max(0, blocks.length - 1))]
  const weekId = block ? block.weeks[0].id : allSlots[0]?.id
  const studioOf = (cohort) => courses.find((c) => c.cohort === cohort && c.slots.includes(weekId)) || null

  // Weekly DE electives for a cohort.
  const weeklyElectivesFor = (cohort) => weeklyElectives.filter((e) => e.cohort === cohort)
  // Only those that have been assigned to slots.
  const placedElectivesFor = (cohort) =>
    weeklyElectives.filter((e) => e.cohort === cohort && e.weeklySlots?.length > 0)

  const trayElectives = weeklyElectivesFor(leadBatch)

  // The "active" elective — whichever is being dragged OR was clicked in the tray.
  const activeId = dragId || activeElectiveId
  const activeElective = activeId ? weeklyElectives.find((e) => e.id === activeId) : null
  const optimalSlots = activeElective?.prevWeeklySlots || []
  // Something is selected (drag or click) — drives both highlighting and click-to-assign.
  const anyActive = !!(dragId || activeElectiveId)

  const facCount = {}
  if (subView === 'day') shown.forEach((b) => studioOf(b)?.faculty.forEach((f) => (facCount[f] = (facCount[f] || 0) + 1)))
  const clashFor = (b) => {
    const o = studioOf(b)
    return !!o && o.faculty.some((f) => facCount[f] > 1)
  }

  // Assign the active weekly elective to all its prevWeeklySlots.
  const assign = () => {
    const e = weeklyElectives.find((we) => we.id === (dragId || activeElectiveId))
    if (e && e.prevWeeklySlots?.length > 0) {
      updateWeeklyElective({ ...e, weeklySlots: e.prevWeeklySlots })
    }
    setDragId(null)
  }

  // Remove a weekly elective from its assigned slots.
  const unassign = (e) => updateWeeklyElective({ ...e, weeklySlots: null })

  // Right-click a placed elective block to set its exact duration.
  const onEditDuration = (e, ev) => {
    setActiveElectiveId(null)
    setDragId(null)
    setDurationEdit({ id: e.id, x: ev.clientX, y: ev.clientY })
  }
  const saveDuration = (id, time) => {
    const e = weeklyElectives.find((we) => we.id === id)
    if (e) updateWeeklyElective({ ...e, customTime: time })
    setDurationEdit(null)
  }
  // Clear a custom duration — fall back to the institute slot's own timing.
  const resetDuration = (id) => {
    const e = weeklyElectives.find((we) => we.id === id)
    if (e) updateWeeklyElective({ ...e, customTime: null })
    setDurationEdit(null)
  }

  const clearActive = () => setActiveElectiveId(null)

  const toggleTraySelection = (id) => {
    setActiveElectiveId((prev) => (prev === id ? null : id))
    setDragId(null)
  }

  return (
    <div className="p-6">
      {/* Sub-view selector */}
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-500 dark:text-slate-400">Select view</span>
        <div className="relative">
          <select
            value={subView}
            onChange={(e) => switchView(e.target.value)}
            className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none hover:border-slate-300 focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="batch">Batch-specific</option>
            <option value="day">Day-specific</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </label>

      {/* Uniform batch filter chips */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {subView === 'day' && (
          <Chip label="All batches" active={allShown} onClick={() => setShown([...cohorts])} />
        )}
        {cohorts.map((b) => (
          <Chip key={b} label={b} active={shown.includes(b)} onClick={() => onChip(b)} />
        ))}
      </div>

      {/* Day tabs (day view only) */}
      {subView === 'day' && (
        <div className="mt-4 flex gap-1">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                day === d
                  ? 'bg-accent-soft text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-0">
        {/* Jump-to-week rail */}
        <aside className="hidden w-52 shrink-0 border-r border-slate-200 pr-3 md:block dark:border-slate-800">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Jump to week · Batch {leadBatch}
          </div>
          {blocks.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400">No weeks allotted for this batch yet.</p>
          ) : (
            <div className="space-y-1">
              {blocks.map((b, i) => {
                const f = b.weeks[0]
                const l = b.weeks[b.weeks.length - 1]
                const active = i === Math.min(sel, blocks.length - 1)
                return (
                  <button
                    key={i}
                    onClick={() => setSel(i)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition ${
                      active ? 'bg-accent-soft dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${active ? 'text-accent' : 'text-slate-700 dark:text-slate-200'}`}>
                      {fmtD(f.dateRange.start)} – {fmtD(l.dateRange.end)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {b.weeks.length} week{b.weeks.length > 1 ? 's' : ''} ·{' '}
                      {b.weeks.length > 1 ? `${f.label}–${l.label}` : f.label} · {b.course.code}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        {/* Schedule grid — periods across the top in both sub-views */}
        <div className="min-w-0 flex-1 overflow-x-auto pl-6" onClick={clearActive}>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {block
                ? `${fmtD(block.weeks[0].dateRange.start)} – ${fmtD(block.weeks[block.weeks.length - 1].dateRange.end)}`
                : 'Weekly schedule'}
            </h2>
            <span className="text-sm text-slate-400">
              {subView === 'day' ? `${day} · ${shown.length} batch${shown.length > 1 ? 'es' : ''}` : leadBatch}
            </span>
          </div>

          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="w-20 rounded-tl-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  {subView === 'day' ? 'Batch' : 'Day'}
                </th>
                {PERIODS.map((p) =>
                  p.kind === 'lunch' ? (
                    <th key={p.id} className="w-6 border-b border-r border-t border-slate-200 bg-slate-50 px-1 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400 [writing-mode:vertical-rl]">
                        Lunch
                      </span>
                    </th>
                  ) : (
                    <th key={p.id} className="min-w-[96px] border-b border-r border-t border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                      {periodLabel(p.start)} – {periodLabel(p.end)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {subView === 'batch'
                ? DAYS.map((d) => (
                    <tr key={d}>
                      <th className="border-b border-l border-r border-slate-200 bg-slate-50 px-2 py-2 text-left align-top font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {d}
                      </th>
                      <PeriodCells
                        day={d}
                        system={slotSystem}
                        course={studioOf(leadBatch)}
                        electives={placedElectivesFor(leadBatch)}
                        onAssign={assign}
                        onUnassign={unassign}
                        onEditDuration={onEditDuration}
                        dragActive={!!dragId}
                        anyActive={anyActive}
                        optimalSlots={optimalSlots}
                      />
                    </tr>
                  ))
                : shown.map((b) => (
                    <tr key={b}>
                      <th className="border-b border-l border-r border-slate-200 bg-slate-50 px-2 py-2 text-left align-top font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {b}
                      </th>
                      <PeriodCells
                        day={day}
                        system={slotSystem}
                        course={studioOf(b)}
                        electives={placedElectivesFor(b)}
                        clash={clashFor(b)}
                        showFreeSlots={false}
                      />
                    </tr>
                  ))}
            </tbody>
          </table>
          <Legend />
        </div>
      </div>

      {/* Weekly DE electives tray (batch-specific view only) */}
      {subView === 'batch' && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Layers size={12} /> Weekly electives · {leadBatch}
            <span className="font-normal normal-case tracking-normal text-slate-400">
              · click or drag a card, then drop on a highlighted slot · right-click a placed course to set its duration
            </span>
          </div>
          {trayElectives.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">No weekly electives for this batch.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pb-1">
              {trayElectives.map((e) => {
                const placed = e.weeklySlots?.length > 0
                const isActive = activeElectiveId === e.id
                const isDragging = dragId === e.id
                const noSlot = e.prevWeeklySlots.length === 0
                return (
                  <div
                    key={e.id}
                    draggable={!noSlot}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      if (!noSlot) toggleTraySelection(e.id)
                    }}
                    onDragStart={() => {
                      setDragId(e.id)
                      setActiveElectiveId(null)
                    }}
                    onDragEnd={() => setDragId(null)}
                    title={
                      noSlot
                        ? `${e.schedule} — no standard slot match`
                        : `Click to select · drag ${e.code} onto a highlighted slot`
                    }
                    className={`flex w-44 shrink-0 select-none flex-col rounded-xl border px-3 py-2.5 transition ${
                      noSlot
                        ? 'cursor-default border-slate-200 bg-slate-100/60 opacity-60 dark:border-slate-700 dark:bg-slate-800/40'
                        : isActive || isDragging
                          ? 'cursor-grab border-accent ring-2 ring-accent/30 dark:border-accent'
                          : placed
                            ? 'cursor-grab border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                            : 'cursor-grab border-slate-200 bg-white hover:border-accent dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {e.code}
                      </span>
                      {placed && <Check size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] font-medium text-slate-700 dark:text-slate-200">
                      {e.title}
                    </div>
                    <div className="mt-1 truncate text-[10px] text-slate-400">
                      {e.faculty.join(', ') || '—'}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-400">
                      <Clock size={9} className="shrink-0" />
                      {e.schedule}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {durationEdit &&
        (() => {
          const e = weeklyElectives.find((we) => we.id === durationEdit.id)
          return e ? (
            <DurationPopover
              elective={e}
              system={slotSystem}
              x={durationEdit.x}
              y={durationEdit.y}
              onSave={saveDuration}
              onReset={resetDuration}
              onClose={() => setDurationEdit(null)}
            />
          ) : null
        })()}
    </div>
  )
}

// The Master-Timetable weekly view: one entity (a batch, or a faculty member) at
// a time, days down the side and periods across the top. The Student/Faculty
// toggle and the entity dropdown are owned by the parent, so this component just
// renders the schedule for `selected`. A faculty view (or any non-editable use)
// is read-only — no elective tray, no drag-to-assign.
function ControlledWeekly({
  focus,
  courses,
  mode,
  selected,
  editable,
  selfKey = null,
  unavailability = {},
  onMarkUnavailable,
  onClearUnavailable,
  onRequestChange,
  // Course discovery (a student planning their term before it starts): every
  // free cell becomes a way to ask "what could I take here?".
  discover = false,
  pickedCell = null,
  onPickCell,
}) {
  const { slotSystem, weeklyElectives, updateWeeklyElective } = useApp()
  const isFaculty = mode === 'faculty'
  const sel = selected || (isFaculty ? null : focus?.cohort)
  const canEdit = editable && !isFaculty
  // The viewer is looking at their OWN schedule — only then can they select
  // cells, mark unavailability, or raise a change request from the grid.
  const isSelf = isFaculty && !!selfKey && sel === selfKey && !!onMarkUnavailable

  const matches = (c) => (isFaculty ? c.faculty?.includes(sel) : c.cohort === sel)
  const eMatches = (e) => (isFaculty ? e.faculty?.includes(sel) : e.cohort === sel)

  const [dragId, setDragId] = useState(null)
  const [activeElectiveId, setActiveElectiveId] = useState(null)
  const [durationEdit, setDurationEdit] = useState(null)
  const [sel0, setSel0] = useState(0)

  // --- Faculty cell selection + availability (self view only) ---------------
  // Selected free cells (keys `${day}#${periodId}`), a right-click action menu,
  // and the reason-entry popover for marking unavailability.
  const [selectedCells, setSelectedCells] = useState(() => new Set())
  const [menu, setMenu] = useState(null) // { x, y, cells: string[] }
  const [reasonEdit, setReasonEdit] = useState(null) // { x, y, cells: string[], value }

  const clearSelection = () => {
    setSelectedCells((prev) => (prev.size ? new Set() : prev))
    setMenu(null)
  }
  const toggleCell = (key) => {
    setMenu(null)
    setSelectedCells((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
  const openCellMenu = (key, ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    // Right-clicking a cell outside the current selection makes it the sole
    // target; right-clicking within a multi-selection keeps the whole set.
    const cells = selectedCells.has(key) ? [...selectedCells] : [key]
    if (!selectedCells.has(key)) setSelectedCells(new Set([key]))
    setMenu({ x: ev.clientX, y: ev.clientY, cells })
  }
  // Are every menu-target cell already marked unavailable? (offer "clear")
  const menuAllUnavailable =
    menu && menu.cells.length > 0 && menu.cells.every((k) => unavailability[k])
  const startMarkUnavailable = () => {
    if (!menu) return
    const existing = menu.cells.map((k) => unavailability[k]).find(Boolean) || ''
    setReasonEdit({ x: menu.x, y: menu.y, cells: menu.cells, value: existing })
    setMenu(null)
  }
  const saveReason = () => {
    if (!reasonEdit) return
    onMarkUnavailable?.(reasonEdit.cells, reasonEdit.value.trim() || 'Unavailable')
    setReasonEdit(null)
    clearSelection()
  }
  const clearMenuCells = () => {
    if (!menu) return
    onClearUnavailable?.(menu.cells)
    setMenu(null)
    clearSelection()
  }
  const requestChangeForCells = () => {
    if (!menu) return
    const label = menu.cells.map(describeCell).join(', ')
    onRequestChange?.(
      `Regarding my weekly schedule — ${label}: `,
    )
    setMenu(null)
    clearSelection()
  }

  // Dismiss the menu / reason popover / selection on Escape.
  useEffect(() => {
    if (!isSelf) return
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return
      if (reasonEdit) setReasonEdit(null)
      else if (menu) setMenu(null)
      else clearSelection()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isSelf, reasonEdit, menu]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset any in-progress selection when the shown entity changes.
  useEffect(() => {
    setSelectedCells(new Set())
    setMenu(null)
    setReasonEdit(null)
  }, [sel, isFaculty])

  const blocks = useMemo(() => computeBlocks(courses, matches), [courses, sel, isFaculty])
  useEffect(() => setSel0(0), [sel, isFaculty])
  const block = blocks[Math.min(sel0, Math.max(0, blocks.length - 1))]
  const weekId = block ? block.weeks[0].id : allSlots[0]?.id
  const studio = courses.find((c) => matches(c) && c.slots.includes(weekId)) || null

  const placedElectives = weeklyElectives.filter((e) => eMatches(e) && e.weeklySlots?.length > 0)
  const trayElectives = weeklyElectives.filter((e) => eMatches(e))

  const activeId = dragId || activeElectiveId
  const activeElective = activeId ? weeklyElectives.find((e) => e.id === activeId) : null
  const optimalSlots = activeElective?.prevWeeklySlots || []
  const anyActive = !!(dragId || activeElectiveId)

  const assign = () => {
    const e = weeklyElectives.find((we) => we.id === (dragId || activeElectiveId))
    if (e && e.prevWeeklySlots?.length > 0) updateWeeklyElective({ ...e, weeklySlots: e.prevWeeklySlots })
    setDragId(null)
  }
  const unassign = (e) => updateWeeklyElective({ ...e, weeklySlots: null })
  const onEditDuration = (e, ev) => {
    setActiveElectiveId(null)
    setDragId(null)
    setDurationEdit({ id: e.id, x: ev.clientX, y: ev.clientY })
  }
  const saveDuration = (id, time) => {
    const e = weeklyElectives.find((we) => we.id === id)
    if (e) updateWeeklyElective({ ...e, customTime: time })
    setDurationEdit(null)
  }
  const resetDuration = (id) => {
    const e = weeklyElectives.find((we) => we.id === id)
    if (e) updateWeeklyElective({ ...e, customTime: null })
    setDurationEdit(null)
  }
  const clearActive = () => setActiveElectiveId(null)
  const toggleTraySelection = (id) => {
    setActiveElectiveId((prev) => (prev === id ? null : id))
    setDragId(null)
  }

  const entityLabel = isFaculty ? sel || '—' : `Batch ${sel || '—'}`

  return (
    <div className="p-6">
      <div className="flex gap-6">
        {/* Jump-to-week rail — same design as the Programme Curriculum "Jump to"
            rail: a bold entity heading over a left-bordered list of weeks, the
            active week ticked in accent. It steps aside while the discovery
            panel is open: that panel is about one cell in one week, so jumping
            to another week mid-choice would only pull the two out of step. */}
        <nav
          className={`sticky top-4 h-fit w-44 shrink-0 self-start ${
            pickedCell ? 'hidden' : 'hidden md:block'
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jump to</div>
          <div className="mt-2">
            {blocks.length === 0 ? (
              <div className="border-l border-slate-200 py-1 pl-3 text-xs text-slate-400 dark:border-slate-800">
                {isFaculty ? 'No weeks taught yet.' : 'No weeks allotted yet.'}
              </div>
            ) : (
              <div className="border-l border-slate-200 dark:border-slate-800">
                {blocks.map((b, i) => {
                  const f = b.weeks[0]
                  const l = b.weeks[b.weeks.length - 1]
                  const active = i === Math.min(sel0, blocks.length - 1)
                  const dLabel = `${fmtD(f.dateRange.start)} – ${fmtD(l.dateRange.end)}`
                  return (
                    <button
                      key={i}
                      onClick={() => setSel0(i)}
                      className={`-ml-px flex w-full items-center border-l-2 py-1 pl-3 text-left text-xs transition ${
                        active
                          ? 'border-accent font-semibold text-accent'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="shrink-0">{dLabel}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Schedule grid — periods across the top, days down the side */}
        <div
          className="min-w-0 flex-1 overflow-x-auto"
          onClick={() => {
            clearActive()
            if (isSelf) clearSelection()
          }}
        >
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {block
                ? `${fmtD(block.weeks[0].dateRange.start)} – ${fmtD(block.weeks[block.weeks.length - 1].dateRange.end)}`
                : 'Weekly schedule'}
            </h2>
            <span className="text-sm text-slate-400">{entityLabel}</span>
          </div>

          {/* Faculty availability hint — how to use the selectable grid. Turns
              into a live count once cells are picked. */}
          {isSelf && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {selectedCells.size > 0 ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent dark:bg-slate-800 dark:text-slate-100">
                    {selectedCells.size} slot{selectedCells.size > 1 ? 's' : ''} selected
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Right-click to request a change or mark unavailable
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearSelection()
                    }}
                    className="ml-1 rounded-md px-2 py-0.5 font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Ban size={13} className="text-slate-400" />
                  Click free slots in your week to select, then right-click to request a change or
                  mark yourself unavailable.
                </span>
              )}
            </div>
          )}

          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="w-20 rounded-tl-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  Day
                </th>
                {PERIODS.map((p) =>
                  p.kind === 'lunch' ? (
                    <th key={p.id} className="w-6 border-b border-r border-t border-slate-200 bg-slate-50 px-1 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400 [writing-mode:vertical-rl]">
                        Lunch
                      </span>
                    </th>
                  ) : (
                    <th key={p.id} className="min-w-[96px] border-b border-r border-t border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                      {periodLabel(p.start)} – {periodLabel(p.end)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d}>
                  <th className="border-b border-l border-r border-slate-200 bg-slate-50 px-2 py-2 text-left align-top font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {d}
                  </th>
                  <PeriodCells
                    day={d}
                    system={slotSystem}
                    course={studio}
                    electives={placedElectives}
                    onAssign={canEdit ? assign : undefined}
                    onUnassign={canEdit ? unassign : undefined}
                    onEditDuration={canEdit ? onEditDuration : undefined}
                    dragActive={canEdit && !!dragId}
                    anyActive={canEdit && anyActive}
                    optimalSlots={canEdit ? optimalSlots : []}
                    showFreeSlots={!isSelf}
                    selfInteractive={isSelf}
                    selectedCells={selectedCells}
                    unavailable={unavailability}
                    onToggleCell={toggleCell}
                    onCellMenu={openCellMenu}
                    discover={discover}
                    pickedCell={pickedCell}
                    onPickCell={onPickCell}
                  />
                </tr>
              ))}
            </tbody>
          </table>
          <Legend variant={isSelf ? 'faculty' : 'default'} />
        </div>
      </div>

      {/* Weekly DE electives tray — editing only (a batch's own electives). */}
      {canEdit && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Layers size={12} /> Weekly electives · {sel}
            <span className="font-normal normal-case tracking-normal text-slate-400">
              · click or drag a card, then drop on a highlighted slot · right-click a placed course to set its duration
            </span>
          </div>
          {trayElectives.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">No weekly electives for this batch.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pb-1">
              {trayElectives.map((e) => {
                const placed = e.weeklySlots?.length > 0
                const isActive = activeElectiveId === e.id
                const isDragging = dragId === e.id
                const noSlot = e.prevWeeklySlots.length === 0
                return (
                  <div
                    key={e.id}
                    draggable={!noSlot}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      if (!noSlot) toggleTraySelection(e.id)
                    }}
                    onDragStart={() => {
                      setDragId(e.id)
                      setActiveElectiveId(null)
                    }}
                    onDragEnd={() => setDragId(null)}
                    title={
                      noSlot
                        ? `${e.schedule} — no standard slot match`
                        : `Click to select · drag ${e.code} onto a highlighted slot`
                    }
                    className={`flex w-44 shrink-0 select-none flex-col rounded-xl border px-3 py-2.5 transition ${
                      noSlot
                        ? 'cursor-default border-slate-200 bg-slate-100/60 opacity-60 dark:border-slate-700 dark:bg-slate-800/40'
                        : isActive || isDragging
                          ? 'cursor-grab border-accent ring-2 ring-accent/30 dark:border-accent'
                          : placed
                            ? 'cursor-grab border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                            : 'cursor-grab border-slate-200 bg-white hover:border-accent dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {e.code}
                      </span>
                      {placed && <Check size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] font-medium text-slate-700 dark:text-slate-200">
                      {e.title}
                    </div>
                    <div className="mt-1 truncate text-[10px] text-slate-400">{e.faculty.join(', ') || '—'}</div>
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-400">
                      <Clock size={9} className="shrink-0" />
                      {e.schedule}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {durationEdit &&
        (() => {
          const e = weeklyElectives.find((we) => we.id === durationEdit.id)
          return e ? (
            <DurationPopover
              elective={e}
              system={slotSystem}
              x={durationEdit.x}
              y={durationEdit.y}
              onSave={saveDuration}
              onReset={resetDuration}
              onClose={() => setDurationEdit(null)}
            />
          ) : null
        })()}

      {/* Right-click action menu for the selected free cells. */}
      {menu && (
        <CellMenu
          x={menu.x}
          y={menu.y}
          count={menu.cells.length}
          allUnavailable={menuAllUnavailable}
          onRequestChange={requestChangeForCells}
          onMarkUnavailable={startMarkUnavailable}
          onClearUnavailable={clearMenuCells}
          onClose={() => setMenu(null)}
        />
      )}

      {/* Reason entry for marking unavailability. */}
      {reasonEdit && (
        <ReasonPopover
          x={reasonEdit.x}
          y={reasonEdit.y}
          labels={reasonEdit.cells.map(describeCell)}
          value={reasonEdit.value}
          onChange={(v) => setReasonEdit((r) => (r ? { ...r, value: v } : r))}
          onSave={saveReason}
          onClose={() => setReasonEdit(null)}
        />
      )}
    </div>
  )
}

// Free institute-slot chips (S grey, L indigo). `muted` tones them down for the
// cells where a studio or elective is already running on top of them.
function SlotChips({ ids, muted = false }) {
  if (!ids.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${muted ? 'mt-1.5 opacity-70' : ''}`}>
      {ids.map((id) => {
        const isL = id.startsWith('L')
        return (
          <span
            key={id}
            className={`rounded px-1 py-0.5 font-mono text-[10px] ${
              isL
                ? 'bg-indigo-50 font-medium text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {id}
          </span>
        )
      })}
    </div>
  )
}

// One row of period cells for a (day, course). M periods fuse into the studio
// cell; placed weekly electives render as time-accurate bars spanning the
// columns they really cover (they need not fill whole cells), and every cell
// still surfaces its free S / L institute slots. Cells whose slot IDs overlap
// optimalSlots are highlighted green — the historically optimal drop targets for
// the active elective. Right-clicking a placed elective opens the duration editor.
function PeriodCells({ day, system, course, electives = [], clash, onAssign, onUnassign, onEditDuration, dragActive, anyActive, optimalSlots = [], showFreeSlots = true, selfInteractive = false, selectedCells, unavailable = {}, onToggleCell, onCellMenu, discover = false, pickedCell = null, onPickCell }) {
  // Placed electives running today, mapped to the period columns they overlap by
  // their ACTUAL clock time (a custom duration if set, else the slot's timing).
  const eBlocks = electives
    .map((e) => {
      const t = electiveTimeOnDay(system, e, day)
      if (!t) return null
      let a = -1
      let b = -1
      PERIODS.forEach((p, idx) => {
        if (p.kind === 'lunch') return
        if (periodsOverlap(p.start, p.end, t.start, t.end)) {
          if (a < 0) a = idx
          b = idx
        }
      })
      if (a < 0) return null
      return { e, start: t.start, end: t.end, startMin: toMin(t.start), endMin: toMin(t.end), a, b }
    })
    .filter(Boolean)
    .sort((x, y) => x.a - y.a || x.startMin - y.startMin)

  // Merge electives whose column ranges touch into one spanning group cell.
  const groups = []
  for (const blk of eBlocks) {
    const g = groups[groups.length - 1]
    if (g && blk.a <= g.b) {
      g.b = Math.max(g.b, blk.b)
      g.blocks.push(blk)
    } else groups.push({ a: blk.a, b: blk.b, blocks: [blk] })
  }
  const cells = []
  let i = 0
  while (i < PERIODS.length) {
    const p = PERIODS[i]
    if (p.kind === 'lunch') {
      cells.push(<td key={p.id} className="border-b border-r border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40" />)
      i++
      continue
    }

    // Studio (M slot) — fuse the M periods into one seamless block. The slots it
    // covers are not shown (an occupied cell reads as the running studio, nothing else).
    if (mSlotAt(system, day, p) && course) {
      let span = 1
      while (i + span < PERIODS.length && PERIODS[i + span].kind !== 'lunch' && mSlotAt(system, day, PERIODS[i + span])) span++
      cells.push(
        <td key={p.id} colSpan={span} className={`border-b border-r px-3 py-2 align-top ${STUDIO}`}>
          <div className="font-semibold text-slate-800 dark:text-slate-100">{course.code}</div>
          {course.faculty?.length > 0 && (
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{course.faculty.join(', ')}</div>
          )}
          {course.venue && (
            <div className="mt-0.5 flex items-center gap-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <MapPin size={10} className="shrink-0" /> {course.venue}
            </div>
          )}
          {clash && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
              <AlertTriangle size={11} /> clash
            </div>
          )}
        </td>,
      )
      i += span
      continue
    }

    // A placed-elective group — each elective is a grey block (uniform with the
    // semester view) that fills the cell vertically and spans horizontally only
    // as far as its real time. The covered slots aren't shown, so the cell reads
    // as one seamless course block.
    const grp = groups.find((g) => g.a === i)
    if (grp) {
      const span = grp.b - grp.a + 1
      const winStart = toMin(PERIODS[grp.a].start)
      const winLen = Math.max(1, toMin(PERIODS[grp.b].end) - winStart)
      cells.push(
        <td
          key={p.id}
          colSpan={span}
          className="border-b border-r border-slate-200 p-0 align-top dark:border-slate-800"
        >
          <div className="flex h-full min-h-[3.5rem] flex-col gap-px">
            {grp.blocks.map((blk) => {
              const left = ((blk.startMin - winStart) / winLen) * 100
              const width = ((blk.endMin - blk.startMin) / winLen) * 100
              return (
                <div key={blk.e.id} className="relative flex-1">
                  <div
                    onContextMenu={
                      onEditDuration
                        ? (ev) => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            onEditDuration(blk.e, ev)
                          }
                        : undefined
                    }
                    style={{ left: `${left}%`, width: `${Math.max(width, 8)}%` }}
                    title={
                      onEditDuration
                        ? `${blk.e.code} · ${blk.start}–${blk.end} — right-click to set duration`
                        : `${blk.e.code} · ${blk.start}–${blk.end}`
                    }
                    className={`group/elec absolute inset-y-0 flex flex-col justify-center overflow-hidden rounded-md bg-slate-100 px-1.5 dark:bg-slate-800 ${
                      onEditDuration ? 'cursor-context-menu' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                        {blk.e.code}
                      </span>
                      {onUnassign && (
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation()
                            onUnassign(blk.e)
                          }}
                          title="Remove from this slot"
                          className="ml-auto shrink-0 text-slate-400 opacity-0 transition hover:text-red-500 group-hover/elec:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    {blk.e.faculty?.length > 0 && (
                      <span className="truncate text-[9px] text-slate-500 dark:text-slate-400">
                        {blk.e.faculty.join(', ')}
                      </span>
                    )}
                    <span className="truncate text-[9px] text-slate-400 dark:text-slate-500">
                      {blk.start}–{blk.end}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </td>,
      )
      i = grp.b + 1
      continue
    }

    // A free institute-slot cell — the drop / click target for the active elective.
    const { s, l } = freeSlotsAt(system, day, p)
    const ids = [...s, ...l]
    const hasOptimal = optimalSlots.some((sid) => ids.includes(sid))
    const canDrop = !!onAssign && dragActive && hasOptimal
    const canClick = !!onAssign && anyActive && !dragActive && hasOptimal

    // Faculty self view: this free cell is selectable (click) and can be flagged
    // unavailable (right-click → menu). It reads as a calm slot until picked or
    // flagged, then tints accent (selected) or red (unavailable).
    if (selfInteractive) {
      const key = `${day}#${p.id}`
      const reason = unavailable[key]
      const isUnavailable = !!reason
      const isSelected = selectedCells?.has(key)
      cells.push(
        <td
          key={p.id}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCell?.(key)
          }}
          onContextMenu={(e) => onCellMenu?.(key, e)}
          title={
            isUnavailable
              ? `Unavailable — ${reason}`
              : 'Click to select · right-click for options'
          }
          className={`group/cell cursor-pointer border-b border-r px-2 py-2 align-top transition dark:border-slate-800 ${
            isUnavailable
              ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/25'
              : isSelected
                ? 'border-accent bg-accent-soft/60 ring-1 ring-inset ring-accent dark:bg-accent/20'
                : 'border-slate-200 bg-white hover:bg-accent-soft/30 dark:bg-slate-950 dark:hover:bg-slate-800/50'
          }`}
        >
          <div className="flex min-h-[2.25rem] flex-col justify-center">
            {isUnavailable ? (
              <>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                  <Ban size={11} className="shrink-0" /> Unavailable
                </span>
                <span className="mt-0.5 truncate text-[10px] text-red-500/80 dark:text-red-400/70">
                  {reason}
                </span>
              </>
            ) : isSelected ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-accent">
                <Check size={11} className="shrink-0" /> Selected
              </span>
            ) : (
              <span className="text-[10px] text-slate-300 opacity-0 transition group-hover/cell:opacity-100 dark:text-slate-600">
                Free
              </span>
            )}
          </div>
        </td>,
      )
      i++
      continue
    }

    // Course discovery: a free cell offers itself only if it can actually answer
    // the click — a free institute slot AND something in the catalogue that
    // meets there. A cell that would open an empty panel stays inert instead, so
    // the "Add" affordance never promises more than it can give.
    const cellKey = `${day}#${p.id}`
    const canDiscover =
      discover && !!onPickCell && ids.length > 0 && catalogueAt(ids).length > 0
    const isPicked = canDiscover && pickedCell === cellKey

    cells.push(
      <td
        key={p.id}
        onDragOver={canDrop ? (e) => e.preventDefault() : undefined}
        onDrop={canDrop ? (e) => { e.preventDefault(); onAssign() } : undefined}
        onClick={
          canDiscover
            ? (e) => {
                e.stopPropagation()
                onPickCell({
                  key: cellKey,
                  label: `${day} ${periodLabel(p.start)}–${periodLabel(p.end)}`,
                  freeIds: ids,
                })
              }
            : canClick
              ? (e) => { e.stopPropagation(); onAssign() }
              : undefined
        }
        title={canDiscover ? 'Click to see what you can add in this slot' : undefined}
        className={`group/free border-b border-r px-2 py-2 align-top transition dark:border-slate-800 ${
          hasOptimal && anyActive
            ? canDrop
              ? 'cursor-copy border-green-400 bg-green-50 ring-1 ring-inset ring-green-400/60 dark:bg-green-950/25 dark:ring-green-700/50'
              : 'cursor-pointer border-green-300 bg-green-50/70 ring-1 ring-inset ring-green-300/50 dark:bg-green-950/20 dark:ring-green-800/40'
            : isPicked
              ? 'cursor-pointer border-accent bg-accent-soft/60 ring-1 ring-inset ring-accent dark:bg-accent/20'
              : canDiscover
                ? 'cursor-pointer border-slate-200 bg-white hover:bg-accent-soft/30 dark:bg-slate-950 dark:hover:bg-slate-800/50'
                : 'border-slate-200 bg-white dark:bg-slate-950'
        }`}
      >
        {hasOptimal && anyActive && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 dark:bg-green-950/50 dark:text-green-300">
            <Check size={8} /> last year
          </div>
        )}
        {/* Free institute-slot chips are placement scaffolding for the batch view
            (they're the drop targets for weekly electives). The day-specific
            comparison view is read-only, so they'd only add noise there. */}
        {showFreeSlots && <SlotChips ids={ids} />}
        {/* The invitation stays hidden until the pointer is on the cell — the
            grid is read first as a timetable, not as a row of buttons. */}
        {canDiscover && !isPicked && (
          <span className="mt-1 flex items-center gap-0.5 text-[9px] font-medium text-accent opacity-0 transition group-hover/free:opacity-100">
            <Plus size={9} className="shrink-0" /> Add
          </span>
        )}
      </td>,
    )
    i++
  }
  return <>{cells}</>
}

// Right-click duration editor — set the exact start/end a placed elective runs,
// re-mapping it on the grid to that span. Anchored at the cursor.
function DurationPopover({ elective, system, x, y, onSave, onReset, onClose }) {
  const base = electiveBaseTime(system, elective)
  const [start, setStart] = useState(base.start)
  const [end, setEnd] = useState(base.end)
  useEffect(() => {
    const onKey = (ev) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const valid = toMin(end) > toMin(start)
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 268)
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 210)
  return (
    <>
      <div className="fixed inset-0 z-[60]" onMouseDown={onClose} />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ left, top }}
        className="fixed z-[61] w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Clock size={13} /> {elective.code} · duration
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">Start</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
          <label className="flex-1">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">End</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
        </div>
        {!valid && <p className="mt-1.5 text-[10px] text-red-500">End time must be after start.</p>}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => onReset(elective.id)}
            className="text-[11px] font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
          >
            Reset to slot
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={onClose}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={!valid}
              onClick={() => onSave(elective.id, { start, end })}
              className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-accent text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function Legend({ variant = 'default' }) {
  if (variant === 'faculty') {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" />
          Your studio (M slot)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-slate-200 dark:bg-slate-700" />
          Your weekly course
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-accent bg-accent-soft dark:bg-accent/20" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/40" />
          Marked unavailable
        </span>
      </div>
    )
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" />
        Studio (M slot)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-500 dark:bg-slate-800">1A</span>
        free single (S)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded bg-indigo-50 px-1 py-0.5 font-mono text-[9px] text-indigo-500 dark:bg-indigo-950/40">L1</span>
        free lecture block (L)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-slate-200 dark:bg-slate-700" />
        weekly course (placed)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40" />
        optimal slot (last year)
      </span>
    </div>
  )
}
