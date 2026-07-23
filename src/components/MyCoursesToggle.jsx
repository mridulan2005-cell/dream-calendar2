// A two-state segmented toggle shown to a faculty member on the allotment lists:
// narrow to just the courses they teach ("My courses"), or widen to the whole
// department ("All courses"). It sits alongside the existing status
// (allotted / unallotted) filters, so a faculty can scope by ownership and by
// allotment state independently. Drawn to match the section's other segmented
// toggles (e.g. "By batch / By faculty").
export default function MyCoursesToggle({ value, onChange }) {
  return (
    <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {[
        { id: 'mine', label: 'My courses' },
        { id: 'all', label: 'All courses' },
      ].map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            value === o.id
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
