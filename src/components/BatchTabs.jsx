import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { cohorts } from '../data/seed.js'

// Multi-select row of filter chips. Defaults to the batch (cohort) chips shared
// by the Slot and Venue lists, but accepts an explicit `options` list (e.g.
// faculty names) and an `allLabel` so the same control drives a "By faculty"
// filter too. "All …" clears the selection (= show everything); each chip
// toggles its value. Controlled — parent owns the selected-values array.
export default function BatchTabs({ value, onChange, options, allLabel = 'All batches' }) {
  const { courses } = useApp()
  // Only offer cohorts that actually have courses, in seed order — unless an
  // explicit option list is supplied.
  const tags = useMemo(
    () => options ?? cohorts.filter((co) => courses.some((c) => c.cohort === co)),
    [courses, options],
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
        {allLabel}
      </button>
      {tags.map((t) => (
        <button key={t} onClick={() => toggle(t)} className={chip(value.includes(t))}>
          {t}
        </button>
      ))}
    </div>
  )
}
