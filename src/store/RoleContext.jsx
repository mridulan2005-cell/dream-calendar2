import { createContext, useContext, useState } from 'react'

// Who is looking at the app. The Department Timetable Coordinator (`ttc`) gets the
// full planner — running courses, faculty / slot / venue allotment, change-request
// review, publish. A `faculty` member or a `student` is a *viewer*: clicking
// Timetable lands them straight on the published Master Timetable with no planner
// chrome and no review rail. A faculty member additionally sees their own courses
// highlighted and can raise a change request to the coordinator.
export const ROLES = [
  { id: 'ttc', label: 'Dept TTC', desc: 'Timetable coordinator', pill: 'ttc' },
  { id: 'faculty', label: 'Faculty', desc: 'Teaching faculty', pill: 'faculty' },
  { id: 'student', label: 'Student', desc: 'Programme student', pill: 'student' },
]

// The faculty we sign in as while in the `faculty` role. `key` matches the name
// stored on each course's `faculty` array (see data/seed.js); `name` is the label.
export const FACULTY_IDENTITY = { key: 'Anirudha', name: 'Prof. Anirudha Joshi' }

const ROLE_KEY = 'iitb-role'
const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => {
    if (typeof localStorage === 'undefined') return 'ttc'
    return localStorage.getItem(ROLE_KEY) || 'ttc'
  })

  const update = (next) => {
    setRole(next)
    try {
      localStorage.setItem(ROLE_KEY, next)
    } catch {
      /* storage may be unavailable — non-fatal */
    }
  }

  return <RoleContext.Provider value={{ role, setRole: update }}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within a RoleProvider')
  return ctx
}
