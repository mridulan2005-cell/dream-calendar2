import { useState, useMemo } from 'react'
import { X, ChevronDown, SlidersHorizontal } from 'lucide-react'
import {
  COURSE_TAGS,
  ELECTIVE_BASKETS,
  CREDIT_STEPS,
  catalogueAt,
} from '../data/catalogue.js'

const MIN_CR = CREDIT_STEPS[0]
const MAX_CR = CREDIT_STEPS[CREDIT_STEPS.length - 1]

// What a student can add in the slot they just clicked.
//
// The panel hangs off a slot on purpose: the cell has already narrowed the
// catalogue to what can physically go there, so the filters left over are few
// and the list is short enough to read. Three deliberate restraints keep it that
// way — the baskets only appear under Elective (nothing else has baskets), the
// tag dropdown carries its own result counts so no one clicks into an empty
// list, and the panel opens on a tag that actually has something to show.
export default function CourseDiscoveryPanel({ cell, onClose }) {
  // Everything on offer in this cell, before any filter the student sets.
  const atSlot = useMemo(() => catalogueAt(cell.freeIds), [cell.freeIds])

  // How many courses each tag holds HERE — shown in the dropdown so the student
  // can see where the courses are without opening each one in turn.
  const countByTag = useMemo(() => {
    const out = {}
    for (const t of COURSE_TAGS) out[t.id] = atSlot.filter((c) => c.tag === t.id).length
    return out
  }, [atSlot])

  // Open on a tag that has something in it, so the first thing seen is courses
  // rather than an empty state.
  const [tag, setTag] = useState(
    () => (COURSE_TAGS.find((t) => atSlot.some((c) => c.tag === t.id)) || COURSE_TAGS[0]).id,
  )
  const [baskets, setBaskets] = useState([]) // none picked = every basket
  const [minCr, setMinCr] = useState(MIN_CR)
  const [maxCr, setMaxCr] = useState(MAX_CR)
  const [picked, setPicked] = useState(null)

  const isElective = tag === 'elective'
  const filtered = atSlot.filter(
    (c) =>
      c.tag === tag &&
      c.credits >= minCr &&
      c.credits <= maxCr &&
      (!isElective || baskets.length === 0 || baskets.includes(c.basket)),
  )

  // A basket with nothing in it at this slot is a dead end — leave it visible so
  // the set of categories stays stable, but don't invite the click.
  const basketEmpty = (id) => !atSlot.some((c) => c.tag === 'elective' && c.basket === id)

  const narrowed = baskets.length > 0 || minCr !== MIN_CR || maxCr !== MAX_CR
  const changeTag = (v) => {
    setTag(v)
    setBaskets([])
    setPicked(null)
  }
  const toggleBasket = (id) =>
    setBaskets((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  const clearFilters = () => {
    setBaskets([])
    setMinCr(MIN_CR)
    setMaxCr(MAX_CR)
  }

  return (
    <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      {/* The slot being filled — the panel's whole premise, so it leads. */}
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Courses that fit</h2>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {cell.label} · free {cell.freeIds.join(', ')}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={16} />
        </button>
      </header>

      {/* Filters. Tag and the credit range share one line — Tag is the biggest
          cut (and decides whether the baskets below it exist at all), the credit
          slider trims what's left. */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-start gap-3">
          {/* Tag */}
          <div className="min-w-0 flex-1">
            <Label>Tag</Label>
            <div className="relative mt-1.5">
              <select
                value={tag}
                onChange={(e) => changeTag(e.target.value)}
                className="w-full cursor-pointer appearance-none truncate rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-[13px] font-medium text-slate-800 outline-none transition hover:border-accent focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {COURSE_TAGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({countByTag[t.id]})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          {/* Credit range — a dual-handle slider whose ends read the current
              min/max as you drag. */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <Label>Credits</Label>
              {narrowed && (
                <button
                  onClick={clearFilters}
                  className="rounded px-1 text-[10px] font-medium text-slate-400 transition hover:text-accent"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2">
              <CreditRange
                min={minCr}
                max={maxCr}
                onMin={setMinCr}
                onMax={setMaxCr}
              />
            </div>
          </div>
        </div>

        {/* Baskets belong to Elective alone — for every other tag the row would
            be a control that does nothing, so it isn't drawn. */}
        {isElective && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ELECTIVE_BASKETS.map((b) => {
              const empty = basketEmpty(b.id)
              const on = baskets.includes(b.id)
              return (
                <button
                  key={b.id}
                  disabled={empty}
                  onClick={() => toggleBasket(b.id)}
                  title={empty ? `No ${b.label} courses in this slot` : undefined}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    empty
                      ? 'cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                      : on
                        ? 'border-accent bg-accent-soft text-accent dark:border-accent dark:bg-slate-800 dark:text-slate-100'
                        : 'border-slate-200 text-slate-500 hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-2 text-[11px] text-slate-400">
          {filtered.length} course{filtered.length === 1 ? '' : 's'}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
            <SlidersHorizontal size={18} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400">
              {atSlot.length === 0
                ? 'Nothing is offered in this slot.'
                : 'No course here matches these filters.'}
            </p>
            {narrowed && (
              <button
                onClick={clearFilters}
                className="text-[11px] font-semibold text-accent transition hover:brightness-90"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                picked={picked === c.id}
                onClick={() => setPicked((p) => (p === c.id ? null : c.id))}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function Label({ children }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  )
}

// A compact two-thumb range over the catalogue's real credit steps (2–8). The
// thumbs can't cross — the min clamps to the max and vice-versa — so the range is
// never empty, and each end labels its current value as you slide.
function CreditRange({ min, max, onMin, onMax }) {
  const pct = (v) => ((v - MIN_CR) / (MAX_CR - MIN_CR)) * 100
  return (
    <div>
      <div className="relative flex h-4 items-center">
        {/* base track + selected fill */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div
          className="absolute h-1 rounded-full bg-accent"
          style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }}
        />
        <input
          type="range"
          min={MIN_CR}
          max={MAX_CR}
          step={2}
          value={min}
          onChange={(e) => onMin(Math.min(Number(e.target.value), max))}
          aria-label="Minimum credits"
          className="credit-range"
          // Lift the min handle above the max one when they meet at the top end,
          // so it can always be dragged back down.
          style={{ zIndex: min >= max ? 5 : 3 }}
        />
        <input
          type="range"
          min={MIN_CR}
          max={MAX_CR}
          step={2}
          value={max}
          onChange={(e) => onMax(Math.max(Number(e.target.value), min))}
          aria-label="Maximum credits"
          className="credit-range"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
        <span>{min} cr</span>
        <span>{max} cr</span>
      </div>
    </div>
  )
}

// One course, in the fewest lines that still answer "is this for me?": what it
// is, what it's worth, who teaches it and when. Anything more is a detail for
// after the choice, not before it.
function CourseCard({ course, picked, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={picked}
      className={`flex w-full flex-col items-start rounded-xl border bg-white px-3 py-2.5 text-left transition dark:bg-slate-950 ${
        picked
          ? 'border-accent ring-2 ring-accent/30'
          : 'border-slate-200 hover:border-accent dark:border-slate-800'
      }`}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">
          {course.code}
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-slate-400">
          {course.credits} cr
        </span>
      </div>
      <span className="mt-0.5 w-full truncate text-[12px] text-slate-600 dark:text-slate-300">
        {course.title}
      </span>
      <span className="mt-1 w-full truncate text-[10px] text-slate-400">
        {course.faculty.join(', ')} · {course.schedule}
      </span>
    </button>
  )
}
