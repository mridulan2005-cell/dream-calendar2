import { useEffect, useRef } from 'react'
import { X, History, Crosshair, ArrowRight } from 'lucide-react'
import { slotLabel } from '../data/seed.js'

// ── Master-timetable change history ──────────────────────────────────────────
// The timetable's counterpart to the curriculum's "View changes": every place
// the live draft has drifted from last year's carried-over mapping — a course
// moved to different weeks, or a room reassigned. Selecting a change rings and
// scrolls to that course on the grid (so you see the timetable at that point)
// and the row spells out what changed, the old value struck through.
//
// Same right-rail shell as the Review panel (a settled, A/B-tested pattern in
// this surface) so it adds no new visual language — just a calm, scannable list.
export default function TimetableHistory({ changes, selectedCourseId, onSelect, onClose }) {
  const listRef = useRef(null)

  // Esc closes the panel.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Keep the selected change scrolled into view in the list.
  useEffect(() => {
    if (!selectedCourseId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-course="${selectedCourseId}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedCourseId])

  return (
    <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <History size={15} /> Change history
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {changes.length === 0
              ? 'vs. last year'
              : `${changes.length} change${changes.length === 1 ? '' : 's'} vs. last year`}
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <X size={16} />
        </button>
      </header>

      <div ref={listRef} className="thin-scroll flex-1 space-y-2.5 overflow-y-auto p-3">
        {changes.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-slate-400">
            No changes yet — this term still matches last year's timetable.
          </p>
        ) : (
          changes.map((c) => (
            <HistoryCard
              key={c.id}
              c={c}
              selected={c.courseId === selectedCourseId}
              onSelect={() => onSelect(c.courseId)}
            />
          ))
        )}
      </div>
    </aside>
  )
}

// A pair of values with the old one struck through and an arrow to the new —
// the same before→after reading the curriculum diff uses.
function FromTo({ from, to }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-red-400 line-through dark:text-red-400/70">{from || '—'}</span>
      <ArrowRight size={11} className="shrink-0 text-slate-300 dark:text-slate-600" />
      <span className="font-medium text-slate-700 dark:text-slate-200">{to || '—'}</span>
    </span>
  )
}

function HistoryCard({ c, selected, onSelect }) {
  const isVenue = c.field === 'venue'
  return (
    <button
      data-course={c.courseId}
      onClick={onSelect}
      title="Show this course on the grid"
      className={`block w-full rounded-2xl border p-3 text-left transition hover:border-slate-300 dark:hover:border-slate-700 ${
        selected
          ? 'border-accent bg-white shadow-md ring-2 ring-accent/30 dark:bg-slate-950'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          {c.code}
          {selected && <Crosshair size={13} className="text-accent" />}
        </span>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            isVenue
              ? 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
          }`}
        >
          {isVenue ? 'Room' : 'Weeks'}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
        {c.title} · {c.cohort}
      </div>
      <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
        {isVenue ? (
          <FromTo from={c.fromVenue} to={c.toVenue} />
        ) : (
          <FromTo from={c.fromSlots.map(slotLabel).join(', ')} to={c.toSlots.map(slotLabel).join(', ')} />
        )}
      </div>
    </button>
  )
}
