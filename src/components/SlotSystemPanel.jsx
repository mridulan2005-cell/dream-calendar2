import { useState } from 'react'
import { X } from 'lucide-react'
import { slotSystems, slotSystemDays } from '../data/seed.js'
import { useResizableWidth } from '../hooks/useResizableWidth.js'
import ResizeHandle from './ResizeHandle.jsx'

// "View slotting types" as a SIDE PANEL (not a modal): a tab per slot system,
// the slots + the weeks they run on the left, and a weekly view of when those
// slots meet on the right. Minimal styling, matching the app's grid lines.
export default function SlotSystemPanel({ onClose, initial = 'S' }) {
  const [active, setActive] = useState(initial)
  const sys = slotSystems.find((s) => s.id === active) || slotSystems[0]
  const { width, onResizeStart } = useResizableWidth(560)

  return (
    <aside
      style={{ width }}
      className="sticky top-0 flex max-h-[calc(100vh-3rem)] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <ResizeHandle onMouseDown={onResizeStart} />
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold">Slotting Types</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sys.timing}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <X size={18} />
        </button>
      </div>

      {/* System tabs (underline-indicator) */}
      <div className="border-b border-slate-100 dark:border-slate-800">
        <div className="thin-scroll flex gap-1 overflow-x-auto px-3" role="tablist" aria-label="Slot systems">
          {slotSystems.map((s) => {
            const isActive = s.id === active
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(s.id)}
                className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'text-accent'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Slot System {s.id}
                {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body: slot list + weekly grid */}
      <div className="grid flex-1 grid-cols-[150px_1fr] gap-4 overflow-y-auto p-5">
        {/* Left: slots + durations */}
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Slots &amp; duration
          </div>
          <div className="space-y-1">
            {sys.slots.map((s) => (
              <div key={s.id} className="group flex items-baseline gap-2" title={`Runs in: ${s.runs}`}>
                <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {s.id}
                </span>
                <span className="truncate text-[11px] leading-6 text-slate-400">Runs {s.runs}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: weekly view */}
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Weekly view
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-1.5 py-1 text-left font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-800/40" />
                  {slotSystemDays.map((d) => (
                    <th
                      key={d}
                      className="border border-slate-200 bg-slate-50 px-1.5 py-1 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300"
                    >
                      {d.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sys.schedule.map((row) => (
                  <tr key={row.t}>
                    <td className="whitespace-nowrap border border-slate-200 px-1.5 py-1 text-right font-medium text-slate-400 dark:border-slate-800">
                      {row.t}
                    </td>
                    {slotSystemDays.map((d) => {
                      const code = row[d.slice(0, 3)]
                      const isX = code && /X/.test(code)
                      return (
                        <td
                          key={d}
                          className={`border border-slate-200 px-1.5 py-1 text-center dark:border-slate-800 ${
                            code
                              ? isX
                                ? 'bg-accent-soft font-semibold text-accent dark:bg-accent/20'
                                : 'text-slate-600 dark:text-slate-300'
                              : ''
                          }`}
                        >
                          {code || ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-slate-400">{sys.desc}</p>
        </div>
      </div>
    </aside>
  )
}
