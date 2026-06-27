import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

// A small, reusable breadcrumb trail so any deeper view can climb back to where
// it was opened from. Each item is { label, to?, onClick? }:
//   • `to`      → a router Link (returns to that route)
//   • `onClick` → an in-page handler (e.g. closing a sub-view)
//   • neither   → plain text (used for the current page, always the last item)
// The last item always renders as the current, non-interactive page.
export default function Breadcrumbs({ items = [], className = '' }) {
  if (items.length === 0) return null
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-xs text-slate-400 ${className}`}
    >
      {items.map((item, i) => {
        const last = i === items.length - 1
        const interactive = !last && (item.to || item.onClick)
        return (
          <span key={i} className="flex items-center gap-1.5">
            {interactive ? (
              item.to ? (
                <Link
                  to={item.to}
                  state={item.state}
                  className="font-medium transition hover:text-accent"
                >
                  {item.label}
                </Link>
              ) : (
                <button onClick={item.onClick} className="font-medium transition hover:text-accent">
                  {item.label}
                </button>
              )
            ) : (
              <span className={last ? 'font-semibold text-slate-600 dark:text-slate-300' : ''}>
                {item.label}
              </span>
            )}
            {!last && <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" />}
          </span>
        )
      })}
    </nav>
  )
}
