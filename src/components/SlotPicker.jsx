import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Star, CircleAlert } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, slotsSpan, facultyPreferences } from '../data/seed.js'

// Consecutive `duration`-week blocks drawn from the teaching weeks. W8 (the
// mid-sem break) splits contiguity, so no block straddles it. Each block is one
// selectable "slot" — e.g. a 3-week course offers W1–W3, W2–W4, …
function weekBlocks(duration) {
  const d = Math.max(1, duration)
  const runs = []
  let run = []
  for (const s of allSlots) {
    if (s.id === 'M8') {
      if (run.length) runs.push(run)
      run = []
      continue
    }
    run.push(s)
  }
  if (run.length) runs.push(run)
  const blocks = []
  for (const r of runs) for (let i = 0; i + d <= r.length; i++) blocks.push(r.slice(i, i + d))
  return blocks
}

// The "Add slots" field that appears once a slot system is chosen. Options are
// week blocks sized to the course duration; faculty-preferred / clash-free
// blocks float to the top, blocked weeks sink to the bottom. Hovering a row
// reveals its exact dates and teaching days.
export default function SlotPicker({ course, system }) {
  const { updateCourse } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const duration = course.durationWeeks || course.slots.length || 1
  const blockedWeeks = new Set(course.faculty.flatMap((f) => facultyPreferences[f]?.blockedSlots || []))

  const blocks = weekBlocks(duration).map((b) => {
    const ids = b.map((s) => s.id)
    const blockedHit = ids.filter((id) => blockedWeeks.has(id))
    const isCurrent = ids.length === course.slots.length && ids.every((id) => course.slots.includes(id))
    return {
      ids,
      key: ids.join('|'),
      label: b.map((s) => s.label).join(', '),
      span: slotsSpan(ids),
      week: b[0].week,
      blocked: blockedHit.length > 0,
      blockedWeeks: blockedHit,
      isCurrent,
    }
  })

  // Rank: clash-free first, then last-year's choice, then by week. Blocked last.
  const ranked = [...blocks].sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? 1 : -1
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    return a.week - b.week
  })
  const favoured = ranked.filter((b) => !b.blocked).slice(0, 3)
  const favouredKeys = new Set(favoured.map((b) => b.key))
  const rest = ranked.filter((b) => !favouredKeys.has(b.key))

  const selected = blocks.find((b) => b.isCurrent)
  const teachingDays = duration * 5
  const choose = (ids) => {
    updateCourse({ ...course, slots: ids })
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Slots <span className="text-slate-300">· {duration} wk</span>
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-44 items-center justify-between rounded-lg border bg-white py-1.5 pl-3 pr-2 text-sm transition dark:bg-slate-900 ${
          open ? 'border-accent ring-1 ring-accent/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
        }`}
      >
        <span className={`truncate ${selected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
          {selected ? selected.label : 'Choose slots'}
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {favoured.length > 0 && (
            <>
              <div className="flex items-center gap-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                <Star size={11} /> Top picks
                <span className="font-normal normal-case text-slate-400">· Slot System {system?.id}</span>
              </div>
              {favoured.map((b) => (
                <Row key={b.key} block={b} teachingDays={teachingDays} recommended onSelect={() => choose(b.ids)} />
              ))}
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            </>
          )}
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            All slots
          </div>
          {rest.map((b) => (
            <Row key={b.key} block={b} teachingDays={teachingDays} onSelect={() => choose(b.ids)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ block, teachingDays, recommended, onSelect }) {
  return (
    <button
      onClick={onSelect}
      title={`${block.span} · Mon–Fri · ${teachingDays} teaching days${
        block.blocked ? ` · faculty blocked ${block.blockedWeeks.map((w) => w.replace('M', 'W')).join(', ')}` : ''
      }`}
      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
        block.blocked ? 'opacity-60' : ''
      }`}
    >
      <span className="flex items-center gap-1.5">
        {block.isCurrent && <Check size={13} className="text-accent" />}
        <span className="text-sm text-slate-700 dark:text-slate-200">{block.label}</span>
        {recommended && !block.isCurrent && (
          <span className="rounded bg-green-100 px-1 text-[9px] font-semibold uppercase text-green-700 dark:bg-green-950/40 dark:text-green-300">
            best
          </span>
        )}
        {block.blocked && <CircleAlert size={12} className="text-amber-500" />}
      </span>
      <span className="shrink-0 text-[11px] text-slate-400">{block.span}</span>
    </button>
  )
}
