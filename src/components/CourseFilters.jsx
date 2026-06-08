import { Search } from 'lucide-react'
import { PROGRAMS } from '../logic/timetable.js'

// Filter bar shared by the allotment lists. Batchwise: a PROGRAM selector, plus
// a contextual second selector that only appears when the chosen program splits
// further (M.Des. → discipline, M.Des. Research → year). A search box filters by
// code/title. Controlled — parent owns { program, sub, query }.
export default function CourseFilters({
  value,
  onChange,
  searchPlaceholder = 'Search for a course code or name',
  trailing,
}) {
  const { program, sub, query } = value
  const activeProgram = PROGRAMS.find((p) => p.id === program)
  const subCfg = activeProgram?.sub

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Filter by</span>
        <select
          value={program}
          onChange={(e) => onChange({ program: e.target.value, sub: '', query })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">All programmes</option>
          {PROGRAMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {subCfg && (
          <select
            value={sub}
            onChange={(e) => onChange({ program, sub: e.target.value, query })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">All {subCfg.label.toLowerCase()}s</option>
            {subCfg.options.map((o) => (
              <option key={o} value={o}>
                {subCfg.label === 'Year' ? `${o === '1' ? '1st' : '2nd'} year` : o}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <Search size={15} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => onChange({ program, sub, query: e.target.value })}
            placeholder={searchPlaceholder}
            className="w-60 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        {trailing}
      </div>
    </div>
  )
}
