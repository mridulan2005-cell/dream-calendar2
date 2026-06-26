import { useState, useMemo, useEffect } from 'react'
import { MapPin, ChevronDown, AlertTriangle, X, Layers, Check, Clock } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, cohorts } from '../data/seed.js'
import { DAYS, PERIODS, mSlotAt, freeSlotsAt, periodLabel } from '../data/slotSystem.js'

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

const computeBlocks = (courses, cohort) => {
  const occupantOf = (wid) => courses.find((c) => c.cohort === cohort && c.slots.includes(wid)) || null
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
export default function WeeklyTimetable({ focus, courses }) {
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
function PeriodCells({ day, system, course, electives = [], clash, onAssign, onUnassign, onEditDuration, dragActive, anyActive, optimalSlots = [], showFreeSlots = true }) {
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
    cells.push(
      <td
        key={p.id}
        onDragOver={canDrop ? (e) => e.preventDefault() : undefined}
        onDrop={canDrop ? (e) => { e.preventDefault(); onAssign() } : undefined}
        onClick={canClick ? (e) => { e.stopPropagation(); onAssign() } : undefined}
        className={`border-b border-r px-2 py-2 align-top transition dark:border-slate-800 ${
          hasOptimal && anyActive
            ? canDrop
              ? 'cursor-copy border-green-400 bg-green-50 ring-1 ring-inset ring-green-400/60 dark:bg-green-950/25 dark:ring-green-700/50'
              : 'cursor-pointer border-green-300 bg-green-50/70 ring-1 ring-inset ring-green-300/50 dark:bg-green-950/20 dark:ring-green-800/40'
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

function Legend() {
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
