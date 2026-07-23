import { useEffect, useRef, useState } from 'react'
import { User, Check } from 'lucide-react'
import { useRole, ROLES } from '../store/RoleContext.jsx'

// The profile control doubles as the account switcher: tapping it opens a small
// dropdown to choose which kind of user you're viewing the app as (the dept TTC,
// a faculty member, or a student). It writes to the shared RoleContext, so every
// other "viewing as" affordance stays in lock-step with it.
// `variant` only changes how the trigger is drawn: `chip` is the filled circle the
// My IITB top bar uses, `bare` the plain icon the Department Timetable header asks
// for. The menu itself is identical either way.
export default function ProfileMenu({ variant = 'chip' }) {
  const { role, setRole } = useRole()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = ROLES.find((r) => r.id === role) || ROLES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const trigger =
    variant === 'bare'
      ? `text-slate-600 hover:text-accent dark:text-slate-300 ${open ? 'text-accent' : ''}`
      : variant === 'avatar'
        ? `text-body2-medium h-8 w-8 rounded-full ${
            open
              ? 'bg-accent text-white'
              : 'bg-slate-100 text-slate-600 hover:brightness-95 dark:bg-slate-800 dark:text-slate-200'
          }`
        : `h-9 w-9 rounded-full ${
            open
              ? 'bg-accent text-white'
              : 'bg-accent-soft text-accent hover:brightness-95 dark:bg-slate-800 dark:text-slate-200'
          }`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile"
        title={`Viewing as ${current.label} — switch account`}
        className={`flex items-center justify-center transition ${trigger}`}
      >
        {variant === 'avatar' ? 'A' : <User size={variant === 'bare' ? 17 : 18} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Switch account
          </div>
          {ROLES.map((r) => {
            const active = r.id === role
            return (
              <button
                key={r.id}
                onClick={() => {
                  setRole(r.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                  active
                    ? 'bg-accent-soft text-accent dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-bold text-accent dark:bg-slate-700 dark:text-slate-200">
                  {r.label.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.label}</span>
                  <span className="block truncate text-[11px] text-slate-400">{r.desc}</span>
                </span>
                {active && <Check size={15} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
