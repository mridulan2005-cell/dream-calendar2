import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { cohorts } from '../data/seed.js'

// Multi-select row of batch (cohort) filter chips, shared by the Slot and Venue
// allotment lists. "All batches" clears the selection (= show everything); each
// chip toggles its cohort. Controlled — parent owns the selected-cohorts array.
export default function BatchTabs({ value, onChange }) {
  const { courses } = useApp()
  // Only offer cohorts that actually have courses, in seed order.
  const batchTags = useMemo(
    () => cohorts.filter((co) => courses.some((c) => c.cohort === co)),
    [courses],
  )
  const toggle = (t) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])
  const chip = (selected) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${
      selected
        ? 'bg-accent text-white'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
    }`

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => onChange([])} className={chip(value.length === 0)}>
        All batches
      </button>
      {batchTags.map((t) => (
        <button key={t} onClick={() => toggle(t)} className={chip(value.includes(t))}>
          {t}
        </button>
      ))}
    </div>
  )
}
