import { useState, useMemo, useEffect } from 'react'
import { MapPin, ChevronDown, AlertTriangle, X, Layers } from 'lucide-react'
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
// In batch-specific you can drag the batch's weekly electives onto a free slot.
export default function WeeklyTimetable({ focus, courses }) {
  const { updateCourse } = useApp()
  const [subView, setSubView] = useState('batch') // 'batch' | 'day'
  const [shown, setShown] = useState([focus.cohort])
  const [day, setDay] = useState('Mon')
  const [sel, setSel] = useState(0)
  const [dragId, setDragId] = useState(null) // an elective being dragged from the tray

  const switchView = (v) => {
    setSubView(v)
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

  // Weekly electives for a batch (the ones the tray offers / the grid places).
  const electivesOf = (cohort) => courses.filter((c) => c.cohort === cohort && c.type === 'Elective')
  const placedOf = (cohort) => electivesOf(cohort).filter((c) => c.weeklySlot)
  const trayElectives = electivesOf(leadBatch)

  const facCount = {}
  if (subView === 'day') shown.forEach((b) => studioOf(b)?.faculty.forEach((f) => (facCount[f] = (facCount[f] || 0) + 1)))
  const clashFor = (b) => {
    const o = studioOf(b)
    return !!o && o.faculty.some((f) => facCount[f] > 1)
  }

  const assign = (slotId) => {
    const e = courses.find((c) => c.id === dragId)
    if (e && slotId) updateCourse({ ...e, weeklySlot: slotId })
    setDragId(null)
  }
  const unassign = (course) => updateCourse({ ...course, weeklySlot: '' })

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
        <div className="min-w-0 flex-1 overflow-x-auto pl-6">
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
                        course={studioOf(leadBatch)}
                        electives={placedOf(leadBatch)}
                        onAssign={assign}
                        onUnassign={unassign}
                        dragActive={!!dragId}
                      />
                    </tr>
                  ))
                : shown.map((b) => (
                    <tr key={b}>
                      <th className="border-b border-l border-r border-slate-200 bg-slate-50 px-2 py-2 text-left align-top font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {b}
                      </th>
                      <PeriodCells day={day} course={studioOf(b)} electives={placedOf(b)} clash={clashFor(b)} />
                    </tr>
                  ))}
            </tbody>
          </table>
          <Legend />
        </div>
      </div>

      {/* Weekly electives tray (batch-specific) — drag a card onto a free slot. */}
      {subView === 'batch' && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Layers size={12} /> Weekly electives · {leadBatch}
            <span className="font-normal normal-case tracking-normal">
              · drag a card onto a free slot to schedule it
            </span>
          </div>
          {trayElectives.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">No weekly electives for this batch.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trayElectives.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => setDragId(null)}
                  title={`Drag ${c.code} onto a free slot`}
                  className={`flex w-40 shrink-0 cursor-grab select-none flex-col rounded-lg border px-3 py-2 transition active:cursor-grabbing ${
                    c.weeklySlot
                      ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/30'
                      : 'border-slate-200 bg-white hover:border-accent dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {c.code}
                    </span>
                    {c.weeklySlot && (
                      <span className="shrink-0 rounded bg-blue-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                        {c.weeklySlot}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {c.faculty.length ? c.faculty.join(', ') : 'unassigned'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// One row of period cells for a (day, course). M periods fuse into the studio
// cell; every other cell lists the free S / L institute slots, any electives
// dropped into them, and (in batch view) acts as a drop target.
function PeriodCells({ day, course, electives = [], clash, onAssign, onUnassign, dragActive }) {
  const cells = []
  for (let i = 0; i < PERIODS.length; ) {
    const p = PERIODS[i]
    if (p.kind === 'lunch') {
      cells.push(<td key={p.id} className="border-b border-r border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40" />)
      i++
      continue
    }
    if (mSlotAt(day, p) && course) {
      let span = 1
      while (i + span < PERIODS.length && PERIODS[i + span].kind !== 'lunch' && mSlotAt(day, PERIODS[i + span])) span++
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
    } else {
      const { s, l } = freeSlotsAt(day, p)
      const ids = [...s, ...l]
      const placed = electives.filter((e) => ids.includes(e.weeklySlot))
      const freeIds = ids.filter((id) => !placed.some((e) => e.weeklySlot === id))
      const target = freeIds[0]
      const droppable = !!onAssign && dragActive && !!target
      cells.push(
        <td
          key={p.id}
          onDragOver={droppable ? (e) => e.preventDefault() : undefined}
          onDrop={droppable ? () => onAssign(target) : undefined}
          className={`border-b border-r px-2 py-2 align-top transition dark:border-slate-800 ${
            droppable
              ? 'border-dashed border-accent bg-accent-soft/40 dark:bg-slate-800/40'
              : 'border-slate-200 bg-white dark:bg-slate-950'
          }`}
        >
          {placed.map((e) => (
            <div
              key={e.id}
              className="group/elec mb-1 flex items-start justify-between gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-1 dark:border-blue-900/50 dark:bg-blue-950/30"
            >
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-blue-800 dark:text-blue-200">{e.code}</div>
                <div className="truncate text-[9px] text-blue-600/80 dark:text-blue-300/70">
                  {e.weeklySlot} · {e.faculty.join(', ') || '—'}
                </div>
              </div>
              {onUnassign && (
                <button
                  onClick={() => onUnassign(e)}
                  title="Remove from this slot"
                  className="shrink-0 text-blue-400 opacity-0 transition hover:text-red-500 group-hover/elec:opacity-100"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            {freeIds.map((id) => {
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
        </td>,
      )
      i++
    }
  }
  return <>{cells}</>
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
        <span className="h-3 w-3 rounded border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30" />
        weekly elective
      </span>
    </div>
  )
}
