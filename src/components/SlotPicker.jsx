import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, CircleAlert, Lock } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, slotLabel, slotDateRange, facultyPreferences } from '../data/seed.js'
import { isExamWeek, examWeekLabel } from '../data/rules.js'

const slotOrder = (id) => allSlots.findIndex((s) => s.id === id)

// Individual-week slot picker. Instead of pre-baked consecutive blocks, the
// planner ticks the EXACT weeks a course runs in. The number of weeks is capped
// at the course's duration (credits-derived); once that many are chosen, the
// remaining weeks disable. Weeks already taken by ANOTHER course of the same
// batch (cohort) — one that would genuinely clash, i.e. not a parallel elective
// or a planned joint session — are muted and locked, so a cohort clash can't be
// created from here. W8 (the institute-protected mid-sem week) is always locked.
// This stays in sync with the second-tab grid editor via the store's
// BroadcastChannel, so toggling a week here updates the grid and vice-versa.
export default function SlotPicker({ course }) {
  const { courses, updateCourse } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const cap = course.durationWeeks || course.slots.length || 1
  const selected = course.slots
  const selectedSet = new Set(selected)

  // One course per week per batch: any week already held by ANOTHER course of the
  // same batch is locked (a week cannot fit two courses).
  const takenBy = {} // slotId -> occupying course code
  for (const other of courses) {
    if (other.id === course.id || other.cohort !== course.cohort) continue
    for (const s of other.slots) if (!takenBy[s]) takenBy[s] = other.code
  }

  // Faculty availability preferences — soft (amber) warning, still selectable.
  const softBlocked = new Set(
    course.faculty.flatMap((f) => facultyPreferences[f]?.blockedSlots || []),
  )

  const toggle = (slotId) => {
    if (selectedSet.has(slotId)) {
      updateCourse({ ...course, slots: selected.filter((s) => s !== slotId) })
    } else {
      if (selected.length >= cap) return // cap reached — can't add more
      const next = [...selected, slotId].sort((a, b) => slotOrder(a) - slotOrder(b))
      updateCourse({ ...course, slots: next })
    }
  }

  const label = selected.length ? selected.map(slotLabel).join(', ') : 'Choose weeks'

  return (
    <div className="relative" ref={ref}>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Weeks <span className="text-slate-300">· pick {cap}</span>
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-44 items-center justify-between rounded-lg border bg-white py-1.5 pl-3 pr-2 text-sm transition dark:bg-slate-900 ${
          open
            ? 'border-accent ring-1 ring-accent/30'
            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
        }`}
      >
        <span className={`truncate ${selected.length ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
          {label}
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Tick the teaching weeks</span>
            <span className={selected.length === cap ? 'text-green-600' : 'text-accent'}>
              {selected.length}/{cap}
            </span>
          </div>
          {allSlots.map((s) => {
            const checked = selectedSet.has(s.id)
            const examWk = isExamWeek(s.id)
            const occupied = takenBy[s.id]
            const capReached = selected.length >= cap && !checked
            const disabled = !!occupied || capReached
            const soft = softBlocked.has(s.id)
            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={() => toggle(s.id)}
                title={
                  occupied
                    ? `${s.label} already used by ${occupied} for this batch`
                    : examWk
                      ? `${s.label} · ${examWeekLabel(s.id)} — open for teaching`
                      : soft
                        ? `${s.label}: a faculty member flagged this week`
                        : `${s.label} · ${slotDateRange(s.id)}`
                }
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? 'border-accent bg-accent text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {checked && <Check size={12} />}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-200">{s.label}</span>
                {examWk && (
                  <span className="rounded bg-yellow-200 px-1 py-0.5 text-[9px] font-semibold uppercase text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">
                    {examWeekLabel(s.id).replace(' exams', '')}
                  </span>
                )}
                {occupied && <Lock size={11} className="text-slate-400" />}
                {!disabled && soft && <CircleAlert size={12} className="text-amber-500" />}
                <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                  {occupied ? occupied : slotDateRange(s.id)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
