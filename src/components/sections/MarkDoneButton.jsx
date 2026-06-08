import { Check } from 'lucide-react'

// "Mark this section as Done" for an allotment step. Can only be marked done once
// every course in the step is allotted; clicking again un-marks it (which re-locks
// the following steps). This explicit confirmation — not the seed data being
// pre-filled — is what advances the planner.
export default function MarkDoneButton({ done, complete, remaining, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={!done && !complete}
      title={!done && !complete ? `Allot the remaining ${remaining} course(s) first` : undefined}
      className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
        done
          ? 'bg-ok-soft text-green-800'
          : complete
            ? 'bg-accent text-white hover:brightness-95'
            : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800'
      }`}
    >
      {done && <Check size={16} strokeWidth={3} />}
      {done ? 'Marked as done' : "Mark this section as 'Done'"}
    </button>
  )
}
