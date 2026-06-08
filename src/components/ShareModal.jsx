import { useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { Overlay } from './Overlay.jsx'

const ROLES = ['Owner', 'Editor', 'Viewer']

// "Share Draft Department Timetable" — manage who can edit / view the draft.
export default function ShareModal({ onClose }) {
  const { sharedAccess, setShareRole, addShare } = useApp()
  const [query, setQuery] = useState('')

  const addPerson = () => {
    const name = query.trim()
    if (!name) return
    addShare({ name, email: `${name.toLowerCase().replace(/\s+/g, '')}@iitb.ac.in`, role: 'Editor' })
    setQuery('')
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 className="text-xl font-bold">Share Draft Department Timetable</h2>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
          <Search size={16} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPerson()}
            placeholder="Enter a name or an LDAP id"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {query && (
            <button onClick={addPerson} className="text-sm font-medium text-accent">
              Add
            </button>
          )}
        </div>

        <p className="mt-5 text-sm font-medium text-slate-500">People with Access</p>
        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {sharedAccess.map((p, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {p.name[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.email}</div>
                </div>
              </div>
              {p.role === 'Owner' ? (
                <span className="text-sm text-slate-400">Owner</span>
              ) : (
                <select
                  value={p.role}
                  onChange={(e) => setShareRole(i, e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {ROLES.filter((r) => r !== 'Owner').map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95"
          >
            Confirm
          </button>
        </div>
      </div>
    </Overlay>
  )
}
