import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import {
  courses as seedCourses,
  changeRequests as seedRequests,
  sharedAccess as seedShared,
} from '../data/seed.js'
import { applyOp, detectConflicts } from '../logic/timetable.js'

const AppContext = createContext(null)

const initialState = {
  courses: seedCourses,
  changeRequests: seedRequests,
  sharedAccess: seedShared,
  workflow: {
    // Each step is unlocked only after the previous one is explicitly marked done.
    coursesFinalised: false,
    facultyFinalised: false,
    slotFinalised: false,
    venueFinalised: false,
    generated: false, // becomes true after "Generate Timetable"
    published: false,
  },
  theme: 'light',
  past: [], // undo stack: snapshots of { courses, changeRequests }
  future: [], // redo stack
}

// Actions that change the timetable and should be undoable.
const UNDOABLE = new Set([
  'UPDATE_COURSE',
  'UPDATE_COURSES',
  'ACCEPT_REQUEST',
  'REJECT_REQUEST',
  'RESOLVE_REQUESTS',
])
const snapshot = (s) => ({ courses: s.courses, changeRequests: s.changeRequests })

// History wrapper around the base reducer: records a snapshot before each
// undoable change, and handles UNDO / REDO.
function reducer(state, action) {
  if (action.type === 'UNDO') {
    if (!state.past.length) return state
    const prev = state.past[state.past.length - 1]
    return {
      ...state,
      ...prev,
      past: state.past.slice(0, -1),
      future: [snapshot(state), ...state.future],
    }
  }
  if (action.type === 'REDO') {
    if (!state.future.length) return state
    const next = state.future[0]
    return {
      ...state,
      ...next,
      past: [...state.past, snapshot(state)],
      future: state.future.slice(1),
    }
  }
  const nextState = baseReducer(state, action)
  if (UNDOABLE.has(action.type) && nextState !== state) {
    return {
      ...nextState,
      past: [...state.past, snapshot(state)].slice(-100),
      future: [],
    }
  }
  return nextState
}

function baseReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_COURSE': {
      const courses = state.courses.map((c) =>
        c.id === action.course.id ? action.course : c,
      )
      return { ...state, courses }
    }
    // Batch update (e.g. a drag that moves/swaps several courses at once).
    case 'UPDATE_COURSES': {
      const byId = new Map(action.courses.map((c) => [c.id, c]))
      const courses = state.courses.map((c) => byId.get(c.id) || c)
      return { ...state, courses }
    }
    case 'REMOVE_COURSE':
      return { ...state, courses: state.courses.filter((c) => c.id !== action.id) }

    case 'ADD_COURSE':
      return { ...state, courses: [action.course, ...state.courses] }

    case 'FINALISE_COURSES':
      return { ...state, workflow: { ...state.workflow, coursesFinalised: true } }

    // Mark an allotment step (faculty | slot | venue) done / not-done.
    case 'SET_STEP_DONE': {
      const key = `${action.step}Finalised`
      return { ...state, workflow: { ...state.workflow, [key]: action.value } }
    }

    case 'GENERATE':
      return { ...state, workflow: { ...state.workflow, generated: true } }

    case 'ACCEPT_REQUEST': {
      const req = state.changeRequests.find((r) => r.id === action.id)
      if (!req) return state
      const courses = state.courses.map((c) =>
        c.id === req.courseId ? applyOp(c, req.op) : c,
      )
      const changeRequests = state.changeRequests.map((r) =>
        r.id === action.id ? { ...r, status: 'accepted' } : r,
      )
      return { ...state, courses, changeRequests }
    }
    case 'REJECT_REQUEST': {
      const changeRequests = state.changeRequests.map((r) =>
        r.id === action.id ? { ...r, status: 'rejected', rejectionReason: action.reason || '' } : r,
      )
      return { ...state, changeRequests }
    }
    // Mark request(s) resolved WITHOUT applying their literal op — used when the
    // TTC's manual edit (placement mode) supersedes the request.
    case 'RESOLVE_REQUESTS': {
      const ids = new Set(action.ids)
      const changeRequests = state.changeRequests.map((r) =>
        ids.has(r.id) ? { ...r, status: 'accepted' } : r,
      )
      return { ...state, changeRequests }
    }
    case 'SET_SHARE_ROLE': {
      const sharedAccess = state.sharedAccess.map((p, i) =>
        i === action.index ? { ...p, role: action.role } : p,
      )
      return { ...state, sharedAccess }
    }
    case 'ADD_SHARE': {
      return { ...state, sharedAccess: [...state.sharedAccess, action.person] }
    }
    case 'PUBLISH':
      return { ...state, workflow: { ...state.workflow, published: true } }

    case 'SET_THEME':
      return { ...state, theme: action.theme }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Keep the <html> class in sync with the theme for Tailwind dark mode.
  useEffect(() => {
    const root = document.documentElement
    if (state.theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [state.theme])

  // Derived: live conflict analysis over the current courses.
  const conflicts = useMemo(() => detectConflicts(state.courses), [state.courses])

  const pendingRequests = useMemo(
    () => state.changeRequests.filter((r) => r.status === 'pending'),
    [state.changeRequests],
  )

  const value = useMemo(
    () => ({
      ...state,
      conflicts,
      pendingRequests,
      // action creators
      updateCourse: (course) => dispatch({ type: 'UPDATE_COURSE', course }),
      updateCourses: (courses) => dispatch({ type: 'UPDATE_COURSES', courses }),
      finaliseCourses: () => dispatch({ type: 'FINALISE_COURSES' }),
      setStepDone: (step, value) => dispatch({ type: 'SET_STEP_DONE', step, value }),
      removeCourse: (id) => dispatch({ type: 'REMOVE_COURSE', id }),
      addCourse: (course) => dispatch({ type: 'ADD_COURSE', course }),
      generate: () => dispatch({ type: 'GENERATE' }),
      acceptRequest: (id) => dispatch({ type: 'ACCEPT_REQUEST', id }),
      rejectRequest: (id, reason) => dispatch({ type: 'REJECT_REQUEST', id, reason }),
      resolveRequests: (ids) => dispatch({ type: 'RESOLVE_REQUESTS', ids }),
      setShareRole: (index, role) => dispatch({ type: 'SET_SHARE_ROLE', index, role }),
      addShare: (person) => dispatch({ type: 'ADD_SHARE', person }),
      publish: () => dispatch({ type: 'PUBLISH' }),
      toggleTheme: () =>
        dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' }),
      // Undo / redo
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, conflicts, pendingRequests],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
