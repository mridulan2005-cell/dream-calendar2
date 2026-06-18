import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, RotateCcw, Info } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { progress } from '../logic/timetable.js'
import { DAYS, PERIODS } from '../data/slotSystem.js'
import { buildSteps } from '../logic/plannerSteps.js'
import Sidebar from '../components/Sidebar.jsx'
import StepNav from '../components/StepNav.jsx'

const SYSTEMS = [
  { id: 'S', label: 'S — Lectures', hint: 'Standard lecture slots (includes X overflow). Used by every course.' },
  { id: 'L', label: 'L — Labs', hint: 'Lab blocks — two consecutive S periods merged.' },
  { id: 'M', label: 'M — Modules', hint: 'IDC module blocks. MA = morning, MB = afternoon.' },
]

// The grid is constant — the seven institute teaching-period columns, split by
// the lunch recess, the same for every system. A slot occupies every column its
// time range overlaps (so a lab or module spans its full block), and the lunch
// recess sits between the morning (C0–C3) and afternoon (C4–C6) halves.
const COLS = PERIODS.filter((p) => p.kind !== 'lunch')
const LUNCH = PERIODS.find((p) => p.kind === 'lunch')
const MORNING_END = 3 // last morning column index; afternoon starts at 4

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const to12 = (t) => {
  const [h, m] = t.split(':').map(Number)
  return { hr: ((h + 11) % 12) + 1, mm: String(m).padStart(2, '0'), mer: h < 12 ? 'AM' : 'PM' }
}
// Column header showing the full range, e.g. "8:00 – 9:25 AM".
const rangeLabel = (start, end) => {
  const a = to12(start)
  const b = to12(end)
  return a.mer === b.mer
    ? `${a.hr}:${a.mm} – ${b.hr}:${b.mm} ${b.mer}`
    : `${a.hr}:${a.mm} ${a.mer} – ${b.hr}:${b.mm} ${b.mer}`
}
// Columns a slot overlaps in time → [firstIdx, lastIdx], or null.
const colRange = (slot) => {
  const idxs = COLS.map((c, i) =>
    toMin(slot.start) < toMin(c.end) && toMin(slot.end) > toMin(c.start) ? i : -1,
  ).filter((i) => i >= 0)
  return idxs.length ? [idxs[0], idxs[idxs.length - 1]] : null
}
// Pack a day's slots into tracks (sub-rows) so two slots never claim the same
// column. Most days need one track; only overlapping bands (e.g. Wed lectures)
// spill onto a second.
const layoutDay = (daySlots) => {
  const items = daySlots
    .map((x) => ({ ...x, range: colRange(x.s) }))
    .filter((x) => x.range)
    .sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1])
  const tracks = []
  for (const it of items) {
    const track = tracks.find((t) => it.range[0] > t[t.length - 1].range[1])
    if (track) track.push(it)
    else tracks.push([it])
  }
  return tracks.length ? tracks : [[]]
}

// Serialise the live slot system back to the institute XML schema (the same
// shape as the uploaded source file).
const toXml = (system) => {
  const attrs = (s) =>
    `id="${s.id}" day="${s.day}" start="${s.start}" end="${s.end}"${s.note ? ` note="${s.note}"` : ''}`
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<SlotSystem version="2026" institute="IITB">']
  for (const key of ['S', 'L', 'M']) {
    lines.push(`  <${key}>`)
    for (const s of system[key] || []) {
      if (s.composedOf && s.composedOf.length) {
        lines.push(`    <Slot ${attrs(s)}>`)
        lines.push(`      <ComposedOf>${s.composedOf.join(' ')}</ComposedOf>`)
        lines.push(`    </Slot>`)
      } else {
        lines.push(`    <Slot ${attrs(s)}/>`)
      }
    }
    lines.push(`  </${key}>`)
  }
  lines.push('</SlotSystem>')
  return lines.join('\n')
}

// The institute slot system, shown as a clean weekly grid — days down the side,
// the fixed teaching-period bands across the top, lunch recess between them.
// Slots span the columns they actually cover, and every cell is editable on
// click; edits write straight back to the store's slot system (persisted +
// broadcast), so every surface that fetches it updates. The main nav and the
// planner step rail stay mounted so this reads as part of the planner.
export default function SlotSystemEditor() {
  const navigate = useNavigate()
  const { courses, conflicts, workflow, activeStep, setActiveStep, slotSystem, updateSlotSystem, resetSlotSystem } =
    useApp()
  const [active, setActive] = useState('S')
  // The cell currently being edited (`s:<index>` for a slot, `e:<day>:<col>` for
  // an empty cell), and its working value.
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')

  const steps = buildSteps(workflow)
  const p = progress(courses)
  const conflictFree = conflicts.conflicts.length === 0

  const list = slotSystem[active] || []
  const commit = (next) => updateSlotSystem({ ...slotSystem, [active]: next })

  // A filled cell commits live on each keystroke (the input stays mounted, so it
  // keeps focus), and drops the slot on blur if it was cleared. An empty cell
  // uses a local draft and only adds a slot on blur.
  const editSlotId = (idx, value) =>
    commit(list.map((s, i) => (i === idx ? { ...s, id: value.toUpperCase() } : s)))
  const removeSlot = (idx) => commit(list.filter((_, i) => i !== idx))
  const addSlot = (day, ci, value) => {
    const v = value.trim().toUpperCase()
    if (v) {
      const col = COLS[ci]
      commit([...list, { id: v, day, start: col.start, end: col.end }])
    }
  }

  const goToStep = (id) => {
    setActiveStep(id)
    navigate('/planner')
  }
  const exportXml = () => {
    const blob = new Blob([toXml(slotSystem)], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'iitb_slot_system.xml'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const sysMeta = SYSTEMS.find((s) => s.id === active)

  // Flatten the day layouts into render rows (a day may contribute >1 track row).
  const rows = []
  for (const day of DAYS) {
    const daySlots = list.map((s, i) => ({ s, i })).filter((x) => x.s.day === day)
    const tracks = layoutDay(daySlots)
    tracks.forEach((track, ti) => rows.push({ day, track, firstOfDay: ti === 0, span: tracks.length }))
  }

  const inputClass =
    'w-full min-w-0 border-b border-accent bg-transparent py-0.5 text-center text-sm font-semibold text-slate-900 outline-none dark:text-white'
  const onInputKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
  }

  // Render the cells of one track within a column segment [from, to].
  const renderSegment = (track, day, from, to) => {
    const items = track
      .filter((it) => it.range[0] >= from && it.range[0] <= to)
      .sort((a, b) => a.range[0] - b.range[0])
    const cells = []
    let ci = from
    const cellClass =
      'cursor-text border border-slate-300 px-2 py-3 text-center align-middle dark:border-slate-700'
    const emptyCell = (col) => {
      const key = `e:${day}:${col}`
      cells.push(
        <td key={key} onClick={() => editing !== key && setEditing(key)} className={cellClass}>
          {editing === key ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                addSlot(day, col, draft)
                setEditing(null)
                setDraft('')
              }}
              onKeyDown={onInputKey}
              className={inputClass}
            />
          ) : (
            <span className="block min-h-[1.25rem]" />
          )}
        </td>,
      )
    }
    for (const it of items) {
      while (ci < it.range[0]) {
        emptyCell(ci)
        ci++
      }
      const last = Math.min(it.range[1], to)
      const key = `s:${it.i}`
      cells.push(
        <td
          key={key}
          colSpan={last - it.range[0] + 1}
          onClick={() => editing !== key && setEditing(key)}
          className={cellClass}
        >
          {editing === key ? (
            <input
              autoFocus
              value={it.s.id}
              onChange={(e) => editSlotId(it.i, e.target.value)}
              onBlur={() => {
                if (!it.s.id.trim()) removeSlot(it.i)
                setEditing(null)
              }}
              onKeyDown={onInputKey}
              className={inputClass}
            />
          ) : (
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{it.s.id}</span>
          )}
        </td>,
      )
      ci = last + 1
    }
    while (ci <= to) {
      emptyCell(ci)
      ci++
    }
    return cells
  }

  return (
    <div className="flex h-full min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <StepNav
        steps={steps}
        active={activeStep}
        onSelect={goToStep}
        stats={{ conflictFree, conflicts: conflicts.conflicts.length }}
        progress={p}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-8 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/planner')}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              <ChevronLeft size={14} /> Back to planner
            </button>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <Info size={17} className="text-slate-400" /> Slot System
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm('Reset the slot system to the institute default? This discards your edits.'))
                  resetSlotSystem()
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <RotateCcw size={14} /> Reset to default
            </button>
            <button
              onClick={exportXml}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300 dark:hover:border-accent"
            >
              <Download size={14} /> Export XML
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="flex flex-wrap items-center gap-2">
            {SYSTEMS.map((s) => {
              const isActive = s.id === active
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive(s.id)
                    setEditing(null)
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'border-accent text-accent dark:border-accent'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sysMeta?.hint}</p>
          <p className="mt-1 text-xs text-slate-400">
            Click any cell to edit it — clearing it removes the slot. Edits save automatically and flow to every
            timetable that reads the slot system.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    Time / Day
                  </th>
                  {COLS.flatMap((c, i) => {
                    const head = (
                      <th
                        key={c.id}
                        className="min-w-[112px] border border-slate-300 bg-slate-50 px-3 py-2 text-center text-[11px] font-medium leading-tight text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {rangeLabel(c.start, c.end)}
                      </th>
                    )
                    // Insert the lunch-recess column header after the last morning
                    // band so the header lines up with the divider cell in the body.
                    if (i === MORNING_END) {
                      return [
                        head,
                        <th
                          key="lunch-head"
                          className="w-8 border border-slate-300 bg-slate-50 px-1 py-2 text-center text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <span className="mx-auto block uppercase tracking-wide [writing-mode:vertical-rl]">Lunch</span>
                        </th>,
                      ]
                    }
                    return [head]
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={`${row.day}-${ri}`}>
                    {row.firstOfDay && (
                      <th
                        rowSpan={row.span}
                        className="whitespace-nowrap border border-slate-300 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {row.day}
                      </th>
                    )}
                    {renderSegment(row.track, row.day, 0, MORNING_END)}
                    {ri === 0 && (
                      <td
                        rowSpan={rows.length}
                        className="border border-slate-300 bg-slate-50 px-1 text-center align-middle dark:border-slate-700 dark:bg-slate-900"
                      >
                        <span className="mx-auto block text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-400 [writing-mode:vertical-rl]">
                          Lunch Recess · {to12(LUNCH.start).hr}:{to12(LUNCH.start).mm} – {to12(LUNCH.end).hr}:
                          {to12(LUNCH.end).mm} {to12(LUNCH.end).mer}
                        </span>
                      </td>
                    )}
                    {renderSegment(row.track, row.day, MORNING_END + 1, COLS.length - 1)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
