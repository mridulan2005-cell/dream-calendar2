// Segmented filter for an allotment list: All / Allotted / Unallotted, each with
// a live count. Lets the planner focus on what still needs doing in the step.
export default function StatusFilter({ value, onChange, counts }) {
  const tabs = [
    { id: 'all', label: 'All', n: counts.all },
    { id: 'allotted', label: 'Allotted', n: counts.allotted, tone: 'ok' },
    { id: 'unallotted', label: 'Unallotted', n: counts.unallotted, tone: 'warn' },
  ]
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {tabs.map((t) => {
        const active = value === t.id
        const badge =
          t.tone === 'ok'
            ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
            : t.tone === 'warn'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>{t.n}</span>
          </button>
        )
      })}
    </div>
  )
}
